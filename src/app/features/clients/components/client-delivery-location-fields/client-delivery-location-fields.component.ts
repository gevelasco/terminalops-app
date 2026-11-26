import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { DestinationRatesService as DestinationRatesApiService } from '@services/api/destination-rates';
import { SessionService } from '@core/services/state/session';
import { DestinationRateLocationFieldsComponent } from '@features/clients/components/destination-rate-location-fields/destination-rate-location-fields.component';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import {
  clientDeliveryRouteLinkHint,
  clientDeliveryRouteLinkTitle,
  isClientDeliveryRouteLookupReady,
  resolveClientDeliveryRoutePreview,
  type ClientDeliveryRouteLinkPreview,
} from '@features/clients/utils/client-delivery-route-link';
import { mexicanSepomexGeocodeHints } from '@features/clients/utils/destination-rate-state-resolve.util';
import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import { normalizeDestinationRateScope } from '@shared/models/destination-rate-scope';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-client-delivery-location-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DestinationRateLocationFieldsComponent,
    ToInputComponent,
    ToIconComponent,
  ],
  templateUrl: './client-delivery-location-fields.component.html',
  styleUrl: './client-delivery-location-fields.component.scss',
})
export class ClientDeliveryLocationFieldsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionService);
  private readonly photon = inject(PhotonPlaceSearchService);
  private readonly ratesApi = inject(DestinationRatesApiService);
  private readonly ratesFeature = inject(DestinationRatesFeatureService);
  private readonly centersFeature = inject(OperationalCentersFeatureService);
  private readonly locationFields = viewChild(DestinationRateLocationFieldsComponent);

  /** CP guardado en BD; si el blur coincide, no se consulta SEPOMEX. */
  readonly referencePostalCode = input('');
  readonly savedDestinationRateId = input<string | null>(null);
  readonly savedIsUnpricedRoute = input(false);

  readonly disabled = input(false);

  readonly postalCode = model('');
  readonly cityMunicipality = model('');
  readonly locality = model('');
  readonly settlementConsId = model('');
  readonly municipalityName = model('');
  readonly stateName = model('');
  readonly latitude = model<number | null>(null);
  readonly longitude = model<number | null>(null);
  readonly destinationRateId = model<string | null>(null);
  readonly isUnpricedRoute = model(false);

  private readonly coordsFromDb = signal(false);

  readonly rateScope = computed(() =>
    normalizeDestinationRateScope(this.session.destinationRateScope()),
  );

  readonly routeLinkStatus = signal<ClientDeliveryRouteLinkPreview>('idle');
  readonly suggestedRouteCount = signal(0);

  readonly routeLinkTitle = computed(() =>
    clientDeliveryRouteLinkTitle(this.routeLinkStatus()),
  );
  readonly routeLinkHint = computed(() =>
    clientDeliveryRouteLinkHint(this.routeLinkStatus()),
  );

  readonly showCoords = computed(
    () => this.latitude() != null && this.longitude() != null,
  );

  readonly latDisplay = computed(() => this.formatCoord(this.latitude()));
  readonly lonDisplay = computed(() => this.formatCoord(this.longitude()));

  constructor() {
    this.centersFeature.loadOperationalCenters();

    effect(() => {
      const refCp = this.referencePostalCode().trim();
      const cp = this.postalCode().trim();
      if (this.rateScope() !== 'postal_code') {
        return;
      }
      if (refCp.length === 5 && cp === refCp) {
        this.coordsFromDb.set(
          this.latitude() != null &&
            this.longitude() != null &&
            !!this.locality().trim(),
        );
      }
    });

    this.bindRouteLinkPipeline();
    this.bindScopedGeocodePipeline();
  }

  /** Restablece el modo lectura (p. ej. al cargar datos desde la API). */
  resetCpEditUi(): void {
    this.locationFields()?.resetCpEditUi();
    this.coordsFromDb.set(
      this.rateScope() === 'postal_code'
        ? this.postalCode().trim().length === 5 &&
            this.latitude() != null &&
            this.longitude() != null &&
            !!this.locality().trim()
        : this.latitude() != null && this.longitude() != null,
    );
    this.syncRouteLinkFromSaved();
  }

  onLocationRouteReset(): void {
    this.latitude.set(null);
    this.longitude.set(null);
    this.coordsFromDb.set(false);
    this.routeLinkStatus.set('idle');
    this.destinationRateId.set(null);
    this.isUnpricedRoute.set(false);
    this.suggestedRouteCount.set(0);
  }

  private bindRouteLinkPipeline(): void {
    combineLatest([
      toObservable(this.rateScope),
      toObservable(this.postalCode),
      toObservable(this.locality),
      toObservable(this.municipalityName),
      toObservable(this.stateName),
      toObservable(this.cityMunicipality),
      toObservable(this.centersFeature.centers),
    ])
      .pipe(
        debounceTime(300),
        map(
          ([
            scope,
            postalCode,
            locality,
            municipalityName,
            stateName,
            cityMunicipality,
            centers,
          ]) => {
            const primary =
              centers.find((c) => c.isDefault) ?? centers[0] ?? null;
            return {
              scope: normalizeDestinationRateScope(scope),
              postalCode: String(postalCode),
              locality: String(locality),
              municipalityName: String(municipalityName),
              stateName: String(stateName),
              cityMunicipality: String(cityMunicipality),
              originCenterId: primary?.id?.trim() ?? '',
            };
          },
        ),
        distinctUntilChanged(
          (a, b) =>
            a.scope === b.scope &&
            normalizeMxPostalCodeDigits(a.postalCode) ===
              normalizeMxPostalCodeDigits(b.postalCode) &&
            a.locality.trim().toLowerCase() === b.locality.trim().toLowerCase() &&
            a.municipalityName.trim().toLowerCase() ===
              b.municipalityName.trim().toLowerCase() &&
            a.stateName.trim().toLowerCase() === b.stateName.trim().toLowerCase() &&
            a.originCenterId === b.originCenterId,
        ),
        tap((input) => {
          if (!isClientDeliveryRouteLookupReady(input)) {
            this.routeLinkStatus.set('idle');
            this.destinationRateId.set(null);
            this.isUnpricedRoute.set(false);
            this.suggestedRouteCount.set(0);
            return;
          }
          this.routeLinkStatus.set('checking');
          this.destinationRateId.set(null);
          this.isUnpricedRoute.set(false);
        }),
        filter((input) => isClientDeliveryRouteLookupReady(input)),
        switchMap((input) => this.resolveRouteLink(input)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Photon: CP con localidad, o ancla municipio/estado. */
  private bindScopedGeocodePipeline(): void {
    combineLatest([
      toObservable(this.rateScope),
      toObservable(this.municipalityName),
      toObservable(this.stateName),
      toObservable(this.locality),
      toObservable(this.cityMunicipality),
      toObservable(this.postalCode),
    ])
      .pipe(
        debounceTime(350),
        switchMap(
          ([
            scope,
            municipalityName,
            stateName,
            locality,
            cityMunicipality,
            postalCode,
          ]) => {
            if (this.coordsFromDb()) {
              return of(null);
            }
            const normalized = normalizeDestinationRateScope(scope);
            if (normalized === 'postal_code') {
              const cp = normalizeMxPostalCodeDigits(String(postalCode));
              const loc = String(locality).trim();
              if (cp.length !== 5 || !loc) {
                return of(null);
              }
              const hints = mexicanSepomexGeocodeHints(
                loc,
                String(cityMunicipality),
              );
              const query = [
                hints.settlement,
                hints.municipality,
                hints.state,
                cp,
                'México',
              ]
                .filter(Boolean)
                .join(', ');
              return this.photon
                .firstCoordinatesForMexicanSepomex(query, hints)
                .pipe(
                  tap((coords) => {
                    this.latitude.set(coords?.lat ?? null);
                    this.longitude.set(coords?.lon ?? null);
                  }),
                );
            }
            const state = String(stateName).trim();
            const municipality =
              normalized === 'municipality'
                ? String(municipalityName).trim()
                : '';
            if (!state || (normalized === 'municipality' && !municipality)) {
              this.latitude.set(null);
              this.longitude.set(null);
              return of(null);
            }
            const hints = {
              state,
              municipality,
              settlement: String(locality).trim(),
            };
            const query = [municipality, state, 'México']
              .filter(Boolean)
              .join(', ');
            return this.photon
              .firstCoordinatesForMexicanSepomex(query, hints)
              .pipe(
                tap((coords) => {
                  this.latitude.set(coords?.lat ?? null);
                  this.longitude.set(coords?.lon ?? null);
                }),
              );
          },
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private resolveRouteLink(input: {
    scope: ReturnType<typeof normalizeDestinationRateScope>;
    postalCode: string;
    locality: string;
    municipalityName: string;
    stateName: string;
    cityMunicipality: string;
    originCenterId: string;
  }) {
    const primaryOriginCenterId = input.originCenterId || null;
    const cachedRates = this.ratesFeature.rates();
    const lookup = {
      postalCode: input.postalCode,
      locality: input.locality,
      municipalityName: input.municipalityName,
      stateName: input.stateName,
      cityMunicipality: input.cityMunicipality,
      scope: input.scope,
    };

    if (!primaryOriginCenterId) {
      const localPreview =
        cachedRates.length > 0
          ? resolveClientDeliveryRoutePreview(cachedRates, {
              ...lookup,
              primaryOriginCenterId: null,
            })
          : { rateId: null, matches: [] as const };
      this.applyRouteLinkPreview(localPreview.rateId, localPreview.matches.length);
      return of(undefined);
    }

    return this.ratesApi
      .checkDestinationRateExists({
        originOperationalCenterId: primaryOriginCenterId,
        postalCode: input.postalCode,
        locality: input.locality,
        municipalityName: input.municipalityName,
        stateName: input.stateName,
        cityMunicipality: input.cityMunicipality,
      })
      .pipe(
        map((check) => check.destinationRateId ?? null),
        tap((rateId) =>
          this.applyRouteLinkPreview(
            rateId,
            this.matchCountHint(lookup, primaryOriginCenterId, rateId),
          ),
        ),
        catchError(() => {
          const fallback =
            cachedRates.length > 0
              ? resolveClientDeliveryRoutePreview(cachedRates, {
                  ...lookup,
                  primaryOriginCenterId,
                })
              : { rateId: null, matches: [] as const };
          this.applyRouteLinkPreview(fallback.rateId, fallback.matches.length);
          return of(undefined);
        }),
        finalize(() => {
          if (this.routeLinkStatus() === 'checking') {
            this.routeLinkStatus.set('idle');
          }
        }),
        map(() => undefined),
      );
  }

  private matchCountHint(
    input: {
      postalCode: string;
      locality: string;
      municipalityName: string;
      stateName: string;
      cityMunicipality: string;
      scope: ReturnType<typeof normalizeDestinationRateScope>;
    },
    primaryOriginCenterId: string | null,
    rateId: string | null,
  ): number {
    const cachedRates = this.ratesFeature.rates();
    if (cachedRates.length > 0) {
      return resolveClientDeliveryRoutePreview(cachedRates, {
        ...input,
        primaryOriginCenterId,
      }).matches.length;
    }
    return rateId ? 1 : 0;
  }

  private applyRouteLinkPreview(rateId: string | null, matchCount: number): void {
    this.suggestedRouteCount.set(matchCount);
    this.destinationRateId.set(rateId);
    this.isUnpricedRoute.set(
      !rateId &&
        isClientDeliveryRouteLookupReady({
          scope: this.rateScope(),
          postalCode: this.postalCode(),
          locality: this.locality(),
          municipalityName: this.municipalityName(),
          stateName: this.stateName(),
        }),
    );
    this.routeLinkStatus.set(rateId ? 'linked' : 'unpriced');
  }

  private syncRouteLinkFromSaved(): void {
    const savedRateId = this.savedDestinationRateId()?.trim();
    if (savedRateId) {
      this.destinationRateId.set(savedRateId);
      this.isUnpricedRoute.set(false);
      this.routeLinkStatus.set('linked');
      return;
    }
    if (
      isClientDeliveryRouteLookupReady({
        scope: this.rateScope(),
        postalCode: this.postalCode(),
        locality: this.locality(),
        municipalityName: this.municipalityName(),
        stateName: this.stateName(),
      }) &&
      this.savedIsUnpricedRoute()
    ) {
      this.destinationRateId.set(null);
      this.isUnpricedRoute.set(true);
      this.routeLinkStatus.set('unpriced');
    }
  }

  private formatCoord(n: number | null): string {
    if (n == null || !Number.isFinite(n)) {
      return '—';
    }
    return n.toFixed(6);
  }
}
