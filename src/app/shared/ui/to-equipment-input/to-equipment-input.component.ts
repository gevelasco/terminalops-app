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
import { catchError, of } from 'rxjs';
import { EquipmentRepository } from '@features/fleet/data/equipment.repository';
import {
  equipmentPickableForUnit,
  formatManeuverEquipmentLabel,
} from '@features/maniobra/utils/assignable-fleet-for-maneuver';
import { Equipment } from '@shared/models/logistics.models';

let seq = 0;

@Component({
  selector: 'to-equipment-input',
  standalone: true,
  templateUrl: './to-equipment-input.component.html',
  styleUrl: './to-equipment-input.component.scss',
})
export class ToEquipmentInputComponent {
  private readonly equipmentRepo = inject(EquipmentRepository);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('');
  readonly disabled = input(false);

  /** Unidad tractora seleccionada; filtra remolques enganchados. */
  readonly unitId = input('');

  readonly equipmentId = model('');

  readonly blurNotify = output<void>();

  readonly inputId = `to-equipment-input-${++seq}`;
  readonly listId = `${this.inputId}-list`;

  readonly loading = signal(true);
  readonly open = signal(false);
  readonly inputText = signal('');
  readonly catalog = signal<Equipment[]>([]);

  readonly pickable = computed(() =>
    equipmentPickableForUnit(this.catalog(), this.unitId()),
  );

  readonly suggestions = computed(() => {
    const list = this.pickable();
    const q = this.inputText().trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((e) =>
      formatManeuverEquipmentLabel(e).toLowerCase().includes(q),
    );
  });

  readonly controlDisabled = computed(() => this.disabled() || !this.unitId().trim());

  constructor() {
    this.equipmentRepo
      .list()
      .pipe(
        catchError(() => of([] as Equipment[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (rows) => {
          this.catalog.set(rows);
          this.syncInputFromEquipmentId();
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    effect(() => {
      const uid = this.unitId();
      const id = this.equipmentId().trim();
      if (!id) {
        this.inputText.set('');
        return;
      }
      const row = this.pickable().find((e) => e.id === id);
      if (row) {
        this.inputText.set(this.labelFor(row));
        return;
      }
      if (uid) {
        this.equipmentId.set('');
        this.inputText.set('');
      }
    });
  }

  labelFor(e: Equipment): string {
    return formatManeuverEquipmentLabel(e);
  }

  private syncInputFromEquipmentId(): void {
    const id = this.equipmentId().trim();
    if (!id) {
      return;
    }
    const row = this.pickable().find((e) => e.id === id);
    if (row) {
      this.inputText.set(this.labelFor(row));
    }
  }

  onInput(ev: Event): void {
    if (this.controlDisabled()) {
      return;
    }
    const v = (ev.target as HTMLInputElement).value;
    this.inputText.set(v);
    const currentId = this.equipmentId().trim();
    if (currentId) {
      const selected = this.pickable().find((e) => e.id === currentId);
      if (selected && v.trim() !== this.labelFor(selected)) {
        this.equipmentId.set('');
      }
    }
    this.open.set(true);
  }

  onFocus(): void {
    if (this.controlDisabled() || this.loading()) {
      return;
    }
    if (this.pickable().length > 0) {
      this.open.set(true);
    }
  }

  onControlBlur(): void {
    queueMicrotask(() => this.blurNotify.emit());
  }

  onPickPointerDown(eq: Equipment, ev: Event): void {
    const pe = ev as PointerEvent;
    if (typeof pe.button === 'number' && pe.button !== 0) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    queueMicrotask(() => {
      this.equipmentId.set(eq.id);
      this.inputText.set(this.labelFor(eq));
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
