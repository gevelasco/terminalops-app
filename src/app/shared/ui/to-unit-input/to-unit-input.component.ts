import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
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
import { EquipmentRepository } from '@features/fleet/data/equipment.repository';
import { UnitRepository } from '@features/fleet/data/unit.repository';
import {
  buildManeuverAssignableUnitRows,
  type ManeuverAssignableUnitRow,
} from '@features/maniobra/utils/assignable-fleet-for-maneuver';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import { TripOperationType } from '@shared/models/logistics.models';

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
  private readonly unitsRepo = inject(UnitRepository);
  private readonly equipmentRepo = inject(EquipmentRepository);
  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('');

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

  constructor() {
    forkJoin({
      units: this.unitsRepo.list().pipe(catchError(() => of([]))),
      equipment: this.equipmentRepo.list().pipe(catchError(() => of([]))),
      trips: this.maniobrasRepo.list().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ units, equipment, trips }) => {
          this.rows.set(buildManeuverAssignableUnitRows(units, equipment, trips));
          this.syncInputFromUnitId();
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
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
    queueMicrotask(() => this.blurNotify.emit());
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
