import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { Subject } from 'rxjs';
import {
  createRouteWaypointDraft,
  type DestinationRateRouteWaypointDraft,
} from '@features/clients/utils/destination-rate-route-waypoints.util';
import {
  PhotonPlaceSearchService,
  type PlaceSuggestion,
} from '@shared/services/photon-place-search.service';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';

let fieldSeq = 0;

@Component({
  selector: 'app-destination-rate-route-customize',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToButtonComponent, ToIconComponent],
  templateUrl: './destination-rate-route-customize.component.html',
  styleUrl: './destination-rate-route-customize.component.scss',
})
export class DestinationRateRouteCustomizeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly photon = inject(PhotonPlaceSearchService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly disabled = input(false);
  readonly tollsLoading = input(false);
  /** El botón principal vive fuera (p. ej. junto a «Agregar tipo»). */
  readonly externalTrigger = input(false);

  readonly customizeOpen = model(false);
  readonly draftWaypoints = model<DestinationRateRouteWaypointDraft[]>([]);
  readonly appliedWaypoints = model<DestinationRateRouteWaypointDraft[]>([]);

  readonly recalculate = output<void>();
  readonly resetSuggestedRoute = output<void>();

  readonly searchOpen = signal(false);
  readonly searchText = signal('');
  readonly searchLoading = signal(false);
  readonly searchResults = signal<PlaceSuggestion[]>([]);

  readonly pendingChanges = computed(() => {
    const draft = this.draftWaypoints();
    const applied = this.appliedWaypoints();
    if (draft.length !== applied.length) {
      return true;
    }
    return draft.some((wp, i) => {
      const other = applied[i];
      return (
        !other ||
        wp.rowKey !== other.rowKey ||
        wp.lat !== other.lat ||
        wp.lon !== other.lon
      );
    });
  });

  readonly inputId = `dest-rate-wp-search-${++fieldSeq}`;
  readonly listId = `${this.inputId}-list`;

  private readonly searchQuery$ = new Subject<string>();

  constructor() {
    this.searchQuery$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        filter((q) => q.trim().length >= 3),
        switchMap((q) => {
          this.searchLoading.set(true);
          return this.photon.search(q);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => {
          this.searchResults.set(list);
          this.searchLoading.set(false);
          this.searchOpen.set(list.length > 0);
        },
        error: () => {
          this.searchResults.set([]);
          this.searchLoading.set(false);
        },
      });

    installAutocompleteOutsideDismiss(
      this.host,
      () => this.searchOpen(),
      () => this.searchOpen.set(false),
      this.destroyRef,
    );
  }

  toggleCustomize(): void {
    if (this.disabled()) {
      return;
    }
    this.customizeOpen.update((v) => !v);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    const q = value.trim();
    if (q.length < 3) {
      this.searchResults.set([]);
      this.searchOpen.set(false);
      this.searchLoading.set(false);
      return;
    }
    this.searchQuery$.next(q);
  }

  onSearchFocus(): void {
    if (this.searchResults().length > 0) {
      this.searchOpen.set(true);
    }
  }

  onPickPlace(place: PlaceSuggestion, event: Event): void {
    event.preventDefault();
    if (this.disabled() || this.draftWaypoints().length >= 8) {
      return;
    }
    this.draftWaypoints.update((rows) => [
      ...rows,
      createRouteWaypointDraft(place),
    ]);
    this.searchText.set('');
    this.searchResults.set([]);
    this.searchOpen.set(false);
  }

  removeWaypoint(rowKey: string): void {
    this.draftWaypoints.update((rows) => rows.filter((r) => r.rowKey !== rowKey));
  }

  moveWaypoint(rowKey: string, delta: -1 | 1): void {
    this.draftWaypoints.update((rows) => {
      const idx = rows.findIndex((r) => r.rowKey === rowKey);
      if (idx < 0) {
        return rows;
      }
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= rows.length) {
        return rows;
      }
      const next = [...rows];
      const tmp = next[idx]!;
      next[idx] = next[nextIdx]!;
      next[nextIdx] = tmp;
      return next;
    });
  }

  onRecalculate(): void {
    if (this.disabled()) {
      return;
    }
    this.appliedWaypoints.set([...this.draftWaypoints()]);
    this.recalculate.emit();
  }

  onResetSuggested(): void {
    if (this.disabled()) {
      return;
    }
    this.draftWaypoints.set([]);
    this.appliedWaypoints.set([]);
    this.customizeOpen.set(false);
    this.resetSuggestedRoute.emit();
  }
}