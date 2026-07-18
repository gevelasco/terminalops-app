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
import { fleetEquipmentTypeShortLabel } from '@shared/catalogs/fleet-form-options';
import type { Equipment } from '@shared/models/logistics.models';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';

let fleetEquipmentInputSeq = 0;

/** Búsqueda insensible a mayúsculas y acentos (Góndola ↔ gondola). */
function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

@Component({
  selector: 'to-fleet-equipment-input',
  standalone: true,
  templateUrl: './to-fleet-equipment-input.component.html',
  styleUrl: './to-fleet-equipment-input.component.scss',
})
export class ToFleetEquipmentInputComponent {
  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('Buscar equipo…');
  readonly equipment = input<Equipment[]>([]);

  readonly equipmentId = model('');

  readonly blurNotify = output<void>();

  readonly inputId = `to-fleet-equipment-input-${++fleetEquipmentInputSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly inputText = signal('');
  readonly open = signal(false);

  private readonly rows = computed(() =>
    this.equipment().map((e) => {
      const id =
        formatEquipmentOperationalId(e) || e.name?.trim() || e.serialNumber?.trim() || e.id;
      const typeLabel = fleetEquipmentTypeShortLabel(e.type);
      return {
        equipment: e,
        label: typeLabel ? `${typeLabel} - ${id}` : id,
      };
    }),
  );

  readonly suggestions = computed(() => {
    const q = normalizeSearchText(this.inputText());
    const list = this.rows();
    if (!q) {
      return list;
    }
    return list.filter((r) => normalizeSearchText(r.label).includes(q));
  });

  constructor() {
    effect(() => {
      const id = this.equipmentId().trim();
      if (!id) {
        if (!this.open()) {
          this.inputText.set('');
        }
        return;
      }
      const row = this.rows().find((r) => r.equipment.id === id);
      if (row) {
        this.inputText.set(row.label);
      }
    });
  }

  onInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.inputText.set(v);
    const currentId = this.equipmentId().trim();
    if (currentId) {
      const selected = this.rows().find((r) => r.equipment.id === currentId);
      if (selected && v.trim() !== selected.label) {
        this.equipmentId.set('');
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

  onPickPointerDown(row: { equipment: Equipment; label: string }, ev: Event): void {
    const pe = ev as PointerEvent;
    if (typeof pe.button === 'number' && pe.button !== 0) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    queueMicrotask(() => {
      this.equipmentId.set(row.equipment.id);
      this.inputText.set(row.label);
      this.open.set(false);
      this.fieldInput()?.nativeElement.focus();
    });
  }

  clearEquipment(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.equipmentId.set('');
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
