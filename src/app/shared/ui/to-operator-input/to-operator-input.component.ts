import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OperatorsService } from '@services/api/operators';
import {
  Trip,
  TripStatus,
  Operator,
  OperatorOperationalStatus,
} from '@shared/models/logistics.models';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';
import { isFleetResourceActive } from '@shared/utils/fleet-resource-active';

/** Puede asignarse a maniobra si no está ya en una activa. */
const PICKABLE_OPERATOR_STATUSES: OperatorOperationalStatus[] = [
  'available',
  'scheduled',
  'in_use',
];

let seq = 0;

const ACTIVE_MANEUVER_STATUSES: TripStatus[] = ['scheduled', 'in_transit'];

function pickAvailableOperators(
  operators: readonly Operator[],
  trips: readonly Trip[],
): Operator[] {
  const busy = new Set<string>();
  for (const t of trips) {
    if (ACTIVE_MANEUVER_STATUSES.includes(t.status)) {
      busy.add(t.operatorId);
    }
  }
  const avail = operators.filter(
    (o) =>
      isFleetResourceActive(o) &&
      PICKABLE_OPERATOR_STATUSES.includes(o.status) &&
      !busy.has(o.id),
  );
  avail.sort((a, b) => a.name.localeCompare(b.name));
  return avail;
}

@Component({
  selector: 'to-operator-input',
  standalone: true,
  templateUrl: './to-operator-input.component.html',
  styleUrl: './to-operator-input.component.scss',
})
export class ToOperatorInputComponent {
  private readonly operatorsApi = inject(OperatorsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject(ElementRef);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('');

  readonly prefetchMode = input(false);
  readonly operatorsData = input<readonly Operator[]>([]);
  readonly tripsData = input<readonly Trip[]>([]);

  /** Identificador del operador seleccionado (vacío si no hay elección válida). */
  readonly operatorId = model('');

  readonly blurNotify = output<void>();

  readonly inputId = `to-operator-input-${++seq}`;
  readonly listId = `${this.inputId}-list`;

  readonly loading = signal(true);
  readonly open = signal(false);

  /** Operadores activos que no están asignados a una maniobra programada o en curso. */
  readonly availableOperators = signal<Operator[]>([]);

  /** Texto del campo de búsqueda (nombre). */
  readonly inputText = signal('');

  readonly suggestions = computed(() => {
    const ops = this.availableOperators();
    const q = this.inputText().trim().toLowerCase();
    if (!q) {
      return ops;
    }
    return ops.filter((o) => o.name.toLowerCase().includes(q));
  });

  private fetchedFromApi = false;

  constructor() {
    installAutocompleteOutsideDismiss(
      this.hostEl,
      () => this.open(),
      () => this.open.set(false),
      this.destroyRef,
    );

    effect(() => {
      if (this.prefetchMode()) {
        this.availableOperators.set(
          pickAvailableOperators(this.operatorsData(), this.tripsData()),
        );
        this.loading.set(false);
        return;
      }
      if (this.fetchedFromApi) {
        return;
      }
      this.fetchedFromApi = true;
      this.operatorsApi
        .getOperatorsList()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (operators) => {
            this.availableOperators.set(pickAvailableOperators(operators, []));
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
    });
  }

  onInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.inputText.set(v);
    const currentId = this.operatorId().trim();
    if (currentId) {
      const selected = this.availableOperators().find((o) => o.id === currentId);
      if (selected && v.trim() !== selected.name) {
        this.operatorId.set('');
      }
    }
    this.open.set(true);
  }

  onFocus(): void {
    if (!this.loading() && this.availableOperators().length > 0) {
      this.open.set(true);
    }
  }

  onControlBlur(): void {
    queueMicrotask(() => {
      this.open.set(false);
      this.blurNotify.emit();
    });
  }

  onPickPointerDown(op: Operator, ev: Event): void {
    const pe = ev as PointerEvent;
    if (typeof pe.button === 'number' && pe.button !== 0) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    queueMicrotask(() => {
      this.operatorId.set(op.id);
      this.inputText.set(op.name);
      this.open.set(false);
      this.fieldInput()?.nativeElement.focus();
    });
  }

  @HostListener('keydown', ['$event'])
  onHostKeydown(ev: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      this.open.set(false);
    }
  }
}
