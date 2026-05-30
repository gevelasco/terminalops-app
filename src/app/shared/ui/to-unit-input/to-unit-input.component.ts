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
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EquipmentService } from '@services/api/equipment';
import { UnitsService } from '@services/api/units';
import {
  buildManeuverAssignableUnitRows,
  type ManeuverAssignableUnitRow,
} from '@features/trips/utils/assignable-fleet-for-maneuver';
import { Equipment, Trip, TripOperationType, Unit } from '@shared/models/logistics.models';
import { OperationConfigurationResolverService } from '@shared/services/operation-configuration-resolver.service';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';

let seq = 0;

export type UnitPickedEvent = {
  unitId: string;
  operationType: TripOperationType;
  equipmentIds: string[];
};

@Component({
  selector: 'to-unit-input',
  standalone: true,
  templateUrl: './to-unit-input.component.html',
  styleUrl: './to-unit-input.component.scss',
})
export class ToUnitInputComponent {
  private readonly unitsApi = inject(UnitsService);
  private readonly equipmentApi = inject(EquipmentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject(ElementRef);
  private readonly opResolver = inject(OperationConfigurationResolverService);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('');

  readonly prefetchMode = input(false);
  readonly unitsData = input<readonly Unit[]>([]);
  readonly equipmentData = input<readonly Equipment[]>([]);
  readonly tripsData = input<readonly Trip[]>([]);

  readonly unitId = model('');

  readonly blurNotify = output<void>();
  readonly unitPicked = output<UnitPickedEvent>();

  readonly inputId = `to-unit-input-${++seq}`;
  readonly listId = `${this.inputId}-list`;

  readonly loading = signal(true);
  readonly open = signal(false);
  readonly inputText = signal('');
  readonly rows = signal<ManeuverAssignableUnitRow[]>([]);

  readonly suggestions = computed(() => {
    const list = this.rows();
    const q = this.inputText().trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((r) => r.displayLabel.toLowerCase().includes(q));
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
        this.rows.set(
          buildManeuverAssignableUnitRows(
            this.unitsData(),
            this.equipmentData(),
            this.tripsData(),
            this.opResolver,
          ),
        );
        this.syncInputFromUnitId();
        this.loading.set(false);
        return;
      }
      if (this.fetchedFromApi) {
        return;
      }
      this.fetchedFromApi = true;
      forkJoin({
        units: this.unitsApi.getUnitsList().pipe(catchError(() => of([]))),
        equipment: this.equipmentApi.getEquipmentList().pipe(catchError(() => of([]))),
      })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ({ units, equipment }) => {
            this.rows.set(
              buildManeuverAssignableUnitRows(units, equipment, [], this.opResolver),
            );
            this.syncInputFromUnitId();
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
    });
  }

  private syncInputFromUnitId(): void {
    const id = this.unitId().trim();
    if (!id) {
      return;
    }
    const row = this.rows().find((r) => r.unit.id === id);
    if (row) {
      this.inputText.set(row.displayLabel);
    }
  }

  onInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.inputText.set(v);
    const currentId = this.unitId().trim();
    if (currentId) {
      const selected = this.rows().find((r) => r.unit.id === currentId);
      if (selected && v.trim() !== selected.displayLabel) {
        this.unitId.set('');
      }
    }
    this.open.set(true);
  }

  onFocus(): void {
    if (!this.loading() && this.rows().length > 0) {
      this.open.set(true);
    }
  }

  onControlBlur(): void {
    queueMicrotask(() => {
      this.open.set(false);
      this.blurNotify.emit();
    });
  }

  onPickPointerDown(row: ManeuverAssignableUnitRow, ev: Event): void {
    const pe = ev as PointerEvent;
    if (typeof pe.button === 'number' && pe.button !== 0) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    queueMicrotask(() => {
      this.unitId.set(row.unit.id);
      this.inputText.set(row.displayLabel);
      this.open.set(false);
      this.unitPicked.emit({
        unitId: row.unit.id,
        operationType: row.operationType,
        equipmentIds: row.equipmentIds,
      });
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
