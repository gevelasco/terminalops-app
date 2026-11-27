import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  of,
  Subscription,
  switchMap,
  type Observable,
} from 'rxjs';
import { DestinationRatesService as DestinationRatesApiService } from '@services/api/destination-rates';
import { mexicanSepomexGeocodeHints } from '@features/clients/utils/destination-rate-state-resolve.util';
import type {
  CreateDestinationRatePayload,
  DestinationRate,
  UpdateDestinationRatePayload,
} from '@shared/models/destination-rate.models';
import { isValidLatLon } from '@shared/services/lat-lon';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { createRequestGeneration } from '@shared/utils/request-generation';

/**
 * Fuente única de verdad del feature Tarifas por destino.
 * GET list (slim) + GET by id al abrir drawer.
 * Alcance: ruta `/comercial/destination-rates`.
 */
@Injectable()
export class DestinationRatesFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(DestinationRatesApiService);
  private readonly photon = inject(PhotonPlaceSearchService);
  private readonly requestGen = createRequestGeneration();
  private readonly coordsBackfillQueued = new Set<string>();
  private readonly detailGen = createRequestGeneration();

  private readonly _rates = signal<readonly DestinationRate[]>([]);
  private readonly _selectedRateId = signal<string | null>(null);
  private readonly _selectedDetail = signal<DestinationRate | null>(null);
  private readonly _loading = signal(false);
  private readonly _detailLoading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;
  private detailSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly rates = this._rates.asReadonly();
  readonly selectedRateId = this._selectedRateId.asReadonly();
  readonly selectedRate = computed(() => this._selectedDetail());
  readonly loading = this._loading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();

  loadDestinationRates(): void {
    if (this.disposed) {
      return;
    }
    if (this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refreshDestinationRates(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  /** Abre drawer: carga detalle completo por id. */
  selectRate(rateId: string, rate?: DestinationRate): void {
    const id = rateId.trim();
    if (!id) {
      return;
    }
    const sameSelection = this._selectedRateId() === id;
    this._selectedRateId.set(id);
    if (rate?.id === id && this.isRateDetailHydrated(rate)) {
      this._selectedDetail.set(rate);
      this._detailLoading.set(false);
      this.detailSub?.unsubscribe();
      this.detailSub = null;
      return;
    }
    if (sameSelection && (this._selectedDetail()?.id === id || this._detailLoading())) {
      return;
    }
    this._selectedDetail.set(null);
    this.loadSelectedDetail(id);
  }

  /** Filas slim del listado no incluyen ruta/casetas; no sirven como detalle del drawer. */
  private isRateDetailHydrated(rate: DestinationRate): boolean {
    return (
      Array.isArray(rate.routeTollPlazas) ||
      Array.isArray(rate.routeWaypoints) ||
      rate.originLatitude != null ||
      rate.originLongitude != null
    );
  }

  clearSelection(): void {
    this.detailSub?.unsubscribe();
    this.detailSub = null;
    this.detailGen.invalidate();
    this._selectedRateId.set(null);
    this._selectedDetail.set(null);
    this._detailLoading.set(false);
  }

  createDestinationRate(
    payload: CreateDestinationRatePayload,
  ): Observable<DestinationRate> {
    const requestId = this.requestGen.next();
    return this.api.postDestinationRate(payload).pipe(
      switchMap((created) =>
        this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return created;
            }
            this.applyList(list);
            this.selectRate(created.id, created);
            return created;
          }),
        ),
      ),
    );
  }

  updateDestinationRate(
    rate: DestinationRate,
    patch: UpdateDestinationRatePayload,
  ): Observable<DestinationRate> {
    const keepId = this._selectedRateId() ?? rate.id;
    const requestId = this.requestGen.next();
    return this.api.patchDestinationRate(rate.id, patch).pipe(
      switchMap((updated) =>
        this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return updated;
            }
            this.applyList(list);
            if (keepId) {
              this._selectedDetail.set(updated);
              this._selectedRateId.set(keepId);
            }
            return updated;
          }),
        ),
      ),
    );
  }

  deleteDestinationRate(rateId: string): Observable<void> {
    const requestId = this.requestGen.next();
    return this.api.deleteDestinationRate(rateId).pipe(
      switchMap(() => this.fetchList()),
      map((list) => {
        if (!this.canApplyResponse(requestId)) {
          return;
        }
        this.applyList(list);
        if (this._selectedRateId() === rateId) {
          this.clearSelection();
        }
      }),
    );
  }

  private loadSelectedDetail(rateId: string): void {
    const requestId = this.detailGen.next();
    this.detailSub?.unsubscribe();
    this._detailLoading.set(true);
    this.detailSub = this.api
      .getDestinationRateById(rateId)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          if (this.detailGen.isCurrent(requestId)) {
            this._detailLoading.set(false);
          }
        }),
      )
      .subscribe((detail) => {
        if (this.disposed || !this.detailGen.isCurrent(requestId)) {
          return;
        }
        if (this._selectedRateId() !== rateId) {
          return;
        }
        if (!detail) {
          this.clearSelection();
          return;
        }
        this._selectedDetail.set(detail);
      });
  }

  private runFetch(): void {
    if (this.disposed) {
      return;
    }
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.fetchList()
      .pipe(
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (list) => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList(list);
          const selectedId = this._selectedRateId();
          if (selectedId && !list.some((r) => r.id === selectedId)) {
            this.clearSelection();
          }
        },
        error: () => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList([]);
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private fetchList(): Observable<DestinationRate[]> {
    return this.api
      .getDestinationRatesList()
      .pipe(catchError(() => of([] as DestinationRate[])));
  }

  private applyList(list: DestinationRate[]): void {
    this._rates.set(list);
    this.queueMissingDestinationCoords(list);
  }

  /** Tarifas guardadas sin lat/lon (geocoder falló al alta): reintento silencioso. */
  private queueMissingDestinationCoords(list: readonly DestinationRate[]): void {
    if (this.disposed) {
      return;
    }
    for (const rate of list) {
      if (this.rateHasDestinationCoords(rate)) {
        continue;
      }
      if (this.coordsBackfillQueued.has(rate.id)) {
        continue;
      }
      if (!rate.postalCode.trim() || !rate.locality.trim()) {
        continue;
      }
      this.coordsBackfillQueued.add(rate.id);
      this.backfillDestinationCoords(rate)
        .pipe(catchError(() => of(null)))
        .subscribe((updated) => {
          if (!updated || this.disposed) {
            return;
          }
          this._rates.update((rows) =>
            rows.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
          );
        });
    }
  }

  private rateHasDestinationCoords(rate: DestinationRate): boolean {
    const lat = rate.destinationLatitude;
    const lng = rate.destinationLongitude;
    return isValidLatLon(
      lat != null && lng != null ? { lat, lon: lng } : null,
    );
  }

  private backfillDestinationCoords(
    rate: DestinationRate,
  ): Observable<DestinationRate | null> {
    const hints = mexicanSepomexGeocodeHints(rate.locality, rate.cityMunicipality);
    const query = [
      hints.settlement,
      hints.municipality,
      hints.state,
      rate.postalCode.trim(),
      'México',
    ]
      .filter(Boolean)
      .join(', ');
    return this.photon.firstCoordinatesForMexicanSepomex(query, hints).pipe(
      switchMap((coords) => {
        if (!isValidLatLon(coords)) {
          return of(null);
        }
        return this.api.patchDestinationRate(rate.id, {
          destinationLatitude: coords.lat,
          destinationLongitude: coords.lon,
        });
      }),
    );
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.detailGen.invalidate();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this.detailSub?.unsubscribe();
    this.detailSub = null;
    this._rates.set([]);
    this._selectedRateId.set(null);
    this._selectedDetail.set(null);
    this._loading.set(false);
    this._detailLoading.set(false);
    this.initialLoadStarted = false;
  }
}
