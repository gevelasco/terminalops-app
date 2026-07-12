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
import { TripsService } from '@services/api/trips';
import type { TripLinkOption } from '@shared/models/api/api-trips-link-options.model';
import type { Trip } from '@shared/models/logistics.models';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';
import {
  maneuverStatusPillClass,
  maneuverStatusPillLabel,
} from '@shared/utils/maneuver-status-pill';
import {
  formatTripLinkOptionDate,
  formatTripLinkOptionFieldLabel,
  tripToLinkOption,
} from '@shared/utils/trip-link-option-label';
import {
  FLEET_LINK_OPTIONS_SEARCH_DEBOUNCE_MS,
  isFleetLinkOptionsSearchAllowed,
} from '@shared/utils/fleet-link-options-search.util';

let tripInputSeq = 0;

@Component({
  selector: 'to-trip-input',
  standalone: true,
  templateUrl: './to-trip-input.component.html',
  styleUrl: './to-trip-input.component.scss',
})
export class ToTripInputComponent {
  private readonly tripsApi = inject(TripsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject(ElementRef);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('Buscar por código de maniobra…');
  readonly disabled = input(false);

  /** Si es true, usa `tripsData` y no llama a la API. */
  readonly prefetchMode = input(false);
  readonly tripsData = input<readonly Trip[]>([]);
  /** Etiqueta inicial al editar (sin precargar catálogo). */
  readonly displayLabel = input('');

  /** Id interno de la maniobra (`Trip.id`). */
  readonly tripId = model('');

  readonly blurNotify = output<void>();

  readonly inputId = `to-trip-input-${++tripInputSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly tripRows = signal<TripLinkOption[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);
  /** Texto libre en el campo (búsqueda o etiqueta de la maniobra elegida). */
  readonly searchText = signal('');

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRequestedSearch = '';

  readonly selectedTrip = computed(() => {
    const id = this.tripId().trim();
    if (!id) {
      return null;
    }
    return this.tripRows().find((t) => t.id === id) ?? null;
  });

  readonly suggestions = computed(() => this.tripRows());

  constructor() {
    installAutocompleteOutsideDismiss(
      this.hostEl,
      () => this.open(),
      () => this.open.set(false),
      this.destroyRef,
    );

    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
    });

    effect(() => {
      if (this.prefetchMode()) {
        this.tripRows.set(this.tripsData().map(tripToLinkOption));
        return;
      }
      const id = this.tripId().trim();
      const label = this.displayLabel().trim();
      if (!id) {
        return;
      }
      const t = this.tripRows().find((x) => x.id === id);
      if (t) {
        const fieldLabel = formatTripLinkOptionFieldLabel(t);
        if (this.searchText() !== fieldLabel) {
          this.searchText.set(fieldLabel);
        }
        return;
      }
      if (label && this.searchText() !== label) {
        this.searchText.set(label);
      }
    });
  }

  tripStatusPillClass(t: TripLinkOption): string {
    return maneuverStatusPillClass(t.status, {
      falseManeuver: t.falseManeuver,
    });
  }

  tripStatusPillLabel(t: TripLinkOption): string {
    return maneuverStatusPillLabel(t.status, {
      falseManeuver: t.falseManeuver,
    });
  }

  tripDateLabel(t: TripLinkOption): string {
    return formatTripLinkOptionDate(t.plannedDepartureAt);
  }

  tripCodeLabel(t: TripLinkOption): string {
    return t.maneuverCode.trim() || t.id;
  }

  onInput(ev: Event): void {
    if (this.disabled()) {
      return;
    }
    const v = (ev.target as HTMLInputElement).value;
    this.searchText.set(v);
    this.open.set(true);

    const sel = this.selectedTrip();
    if (sel && formatTripLinkOptionFieldLabel(sel).trim() !== v.trim()) {
      this.tripId.set('');
    }

    if (!this.prefetchMode()) {
      this.scheduleSearch(v);
    }
  }

  onFocus(): void {
    if (this.disabled()) {
      return;
    }
    if (!this.loading() && this.tripRows().length > 0) {
      this.open.set(true);
    }
  }

  onControlBlur(): void {
    this.blurNotify.emit();
  }

  onPickPointerDown(t: TripLinkOption, ev: Event): void {
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
      this.searchText.set(formatTripLinkOptionFieldLabel(t));
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

  private scheduleSearch(raw: string): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(
      () => this.fetchLinkOptions(raw),
      FLEET_LINK_OPTIONS_SEARCH_DEBOUNCE_MS,
    );
  }

  private fetchLinkOptions(raw: string): void {
    if (this.prefetchMode()) {
      const q = raw.trim().toLowerCase();
      const list = this.tripsData().map(tripToLinkOption);
      this.tripRows.set(
        q
          ? list.filter((t) => {
              const code = (t.maneuverCode || t.id).toLowerCase();
              return code.includes(q) || t.id.includes(q);
            })
          : list,
      );
      return;
    }

    const search = raw.trim();
    if (!isFleetLinkOptionsSearchAllowed(search)) {
      this.tripRows.set([]);
      this.loading.set(false);
      return;
    }

    if (search === this.lastRequestedSearch && this.tripRows().length > 0) {
      return;
    }
    this.lastRequestedSearch = search;
    this.loading.set(true);
    this.tripsApi
      .getTripLinkOptions({ search, limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items }) => {
          this.tripRows.set(items);
          this.loading.set(false);
          if (items.length > 0) {
            this.open.set(true);
          }
        },
        error: () => this.loading.set(false),
      });
  }
}
