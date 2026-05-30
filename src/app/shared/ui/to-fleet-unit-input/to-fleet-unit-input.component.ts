import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { formatUnitTrailerLabel } from '@shared/utils/fleet/unit-label';
import type { Unit } from '@shared/models/logistics.models';
import { resourceIdKey } from '@shared/utils/resource-id';

let fleetUnitInputSeq = 0;

@Component({
  selector: 'to-fleet-unit-input',
  standalone: true,
  templateUrl: './to-fleet-unit-input.component.html',
  styleUrl: './to-fleet-unit-input.component.scss',
})
export class ToFleetUnitInputComponent {
  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('Buscar tractora…');
  readonly units = input<Unit[]>([]);

  readonly unitId = model('');

  readonly blurNotify = output<void>();

  readonly inputId = `to-fleet-unit-input-${++fleetUnitInputSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly inputText = signal('');
  readonly open = signal(false);

  private readonly rows = computed(() =>
    this.units().map((u) => ({
      unit: u,
      label: formatUnitTrailerLabel(u),
    })),
  );

  readonly suggestions = computed(() => {
    const q = this.inputText().trim().toLowerCase();
    const list = this.rows();
    if (!q) {
      return list;
    }
    return list.filter((r) => r.label.toLowerCase().includes(q));
  });

  constructor() {
    effect(() => {
      const id = this.unitId().trim();
      if (!id) {
        if (!this.open()) {
          this.inputText.set('');
        }
        return;
      }
      const row = this.rows().find((r) => r.unit.id === id);
      if (row) {
        this.inputText.set(row.label);
      }
    });
  }

  onInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.inputText.set(v);
    const currentId = this.unitId().trim();
    if (currentId) {
      const selected = this.rows().find((r) => r.unit.id === currentId);
      if (selected && v.trim() !== selected.label) {
        this.unitId.set('');
      }
    }
    this.open.set(true);
  }

  onFocus(): void {
    if (this.rows().length > 0) {
      this.open.set(true);
    }
  }

  onControlBlur(): void {
    queueMicrotask(() => this.blurNotify.emit());
  }

  onPickPointerDown(row: { unit: Unit; label: string }, ev: Event): void {
    const pe = ev as PointerEvent;
    if (typeof pe.button === 'number' && pe.button !== 0) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    queueMicrotask(() => {
      this.unitId.set(row.unit.id);
      this.inputText.set(row.label);
      this.open.set(false);
      this.fieldInput()?.nativeElement.focus();
    });
  }

  clearUnit(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.unitId.set('');
    this.inputText.set('');
    this.open.set(false);
    this.fieldInput()?.nativeElement.focus();
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
