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
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import type { Trip } from '@shared/models/logistics.models';
import { formatTripListLabel } from '@shared/utils/trip-list-label';
import {
  maneuverStatusPillClass,
  maneuverStatusPillLabel,
} from '@shared/utils/maneuver-status-pill';

let tripInputSeq = 0;

const MAX_SUGGESTIONS = 50;

@Component({
  selector: 'to-trip-input',
  standalone: true,
  templateUrl: './to-trip-input.component.html',
  styleUrl: './to-trip-input.component.scss',
})
export class ToTripInputComponent {
  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('Buscar por código, ruta o cliente…');
  readonly disabled = input(false);

  /** Id interno de la maniobra (`Trip.id`). */
  readonly tripId = model('');

  readonly blurNotify = output<void>();

  readonly inputId = `to-trip-input-${++tripInputSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly trips = signal<Trip[]>([]);
  readonly loading = signal(true);
  readonly open = signal(false);
  /** Texto libre en el campo (búsqueda o etiqueta de la maniobra elegida). */
  readonly searchText = signal('');

  readonly selectedTrip = computed(() => {
    const id = this.tripId().trim();
    if (!id) {
      return null;
    }
    return this.trips().find((t) => t.id === id) ?? null;
  });

  readonly suggestions = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    const all = this.trips();
    if (!all.length) {
      return [];
    }
    if (!q) {
      return all.slice(0, MAX_SUGGESTIONS);
    }
    const filtered = all.filter((t) => {
      const code = (t.maneuverCode ?? t.id).toLowerCase();
      const origin = t.origin.toLowerCase();
      const dest = t.destination.toLowerCase();
      const client = (t.clientName ?? '').toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        code.includes(q) ||
        origin.includes(q) ||
        dest.includes(q) ||
        client.includes(q)
      );
    });
    return filtered.slice(0, MAX_SUGGESTIONS);
  });

  constructor() {
    this.maniobrasRepo
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.trips.set(rows);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    effect(() => {
      const id = this.tripId().trim();
      if (!id) {
        return;
      }
      const t = this.trips().find((x) => x.id === id);
      if (t) {
        const label = formatTripListLabel(t);
        if (this.searchText() !== label) {
          this.searchText.set(label);
        }
      }
    });
  }

  tripStatusPillClass(t: Trip): string {
    return maneuverStatusPillClass(t.status, {
      falseManeuver: t.falseManeuver === true,
    });
  }

  tripStatusPillLabel(t: Trip): string {
    return maneuverStatusPillLabel(t.status, {
      falseManeuver: t.falseManeuver === true,
    });
  }

  tripListLabel(t: Trip): string {
    return formatTripListLabel(t);
  }

  onInput(ev: Event): void {
    if (this.disabled()) {
      return;
    }
    const v = (ev.target as HTMLInputElement).value;
    this.searchText.set(v);
    this.open.set(true);

    const sel = this.selectedTrip();
    if (sel && formatTripListLabel(sel).trim() !== v.trim()) {
      this.tripId.set('');
    }
  }

  onFocus(): void {
    if (this.disabled()) {
      return;
    }
    if (!this.loading() && this.trips().length > 0) {
      this.open.set(true);
    }
  }

  onControlBlur(): void {
    this.blurNotify.emit();
  }

  onPickPointerDown(t: Trip, ev: Event): void {
    if (this.disabled()) {
      return;
    }
    const pe = ev as PointerEvent;
    if (typeof pe.button === 'number' && pe.button !== 0) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    queueMicrotask(() => {
      this.tripId.set(t.id);
      this.searchText.set(formatTripListLabel(t));
      this.open.set(false);
      const el = this.fieldInput()?.nativeElement;
      el?.focus();
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
