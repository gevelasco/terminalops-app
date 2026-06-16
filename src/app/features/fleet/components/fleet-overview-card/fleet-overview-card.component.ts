import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { fleetRenewalIconClass } from '@features/fleet/utils/fleet-overview-card';
import {
  overviewAssetAt,
  overviewPrimaryAsset,
  overviewSecondaryAsset,
  overviewTrailerVisualAt,
  overviewTripArrivalLine,
  overviewTripDepartureLine,
  renewalBucketFromOverview,
  SCHEMA_TRACTO,
  type FleetOverviewCardEntry,
} from '@features/fleet/utils/fleet-overview-view';
import {
  overviewTripEtaDaysLabel,
  overviewTripEtaKmLabel,
  overviewTripCompletionLine,
  overviewTripProgress,
} from '@features/fleet/utils/fleet-overview-trip-metrics';
import type { FleetRenewalBucket } from '@features/fleet/utils/fleet-unit-table-row';

@Component({
  selector: 'app-fleet-overview-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fleet-overview-card-host',
    '[class.fleet-overview-card-host--readonly]': 'readonly()',
    '[class.fleet-overview-card-host--selectable]': 'tripSelectable()',
    '[attr.role]': 'tripSelectable() ? "button" : null',
    '[attr.tabindex]': 'tripSelectable() ? 0 : null',
    '(click)': 'onCardActivate($event)',
    '(keydown)': 'onCardKeydown($event)',
  },
  templateUrl: './fleet-overview-card.component.html',
  styleUrl: './fleet-overview-card.component.scss',
})
export class FleetOverviewCardComponent {
  readonly entry = input.required<FleetOverviewCardEntry>();
  readonly readonly = input(false);
  readonly tripSelectable = input(false);

  readonly tripSelect = output<string>();

  readonly schemaTractoAsset = SCHEMA_TRACTO;

  onCardActivate(event: Event): void {
    if (!this.tripSelectable()) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest('.fleet-overview__hit')) {
      return;
    }
    this.emitTripSelect();
  }

  onCardKeydown(event: KeyboardEvent): void {
    if (!this.tripSelectable()) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.emitTripSelect();
  }

  private emitTripSelect(): void {
    const tripId = this.entry().trip?.tripId;
    if (tripId == null) {
      return;
    }
    this.tripSelect.emit(String(tripId));
  }

  isFull(entry: FleetOverviewCardEntry): boolean {
    return entry.isFullConvoy;
  }

  usesPlataforma(entry: FleetOverviewCardEntry): boolean {
    return entry.usesPlataforma;
  }

  usesPlataformaAt(entry: FleetOverviewCardEntry, index: number): boolean {
    return overviewTrailerVisualAt(entry, index) === 'plataforma';
  }

  usesCajaSeca(entry: FleetOverviewCardEntry): boolean {
    return entry.usesCajaSeca;
  }

  usesCajaSecaAt(entry: FleetOverviewCardEntry, index: number): boolean {
    return overviewTrailerVisualAt(entry, index) === 'caja_seca';
  }

  trailerAlt(entry: FleetOverviewCardEntry, position: 'primary' | 'secondary'): string {
    const index = position === 'primary' ? 0 : 1;
    const visual = overviewTrailerVisualAt(entry, index);
    if (visual === 'plataforma') {
      return position === 'primary' ? 'Plataforma (primer equipo)' : 'Plataforma (segundo equipo)';
    }
    if (visual === 'caja_seca') {
      return position === 'primary' ? 'Caja seca (primer equipo)' : 'Caja seca (segundo equipo)';
    }
    return position === 'primary' ? 'Equipo (delantero)' : 'Equipo (trasero)';
  }

  assetAt(entry: FleetOverviewCardEntry, index: number): string {
    return overviewAssetAt(entry, index);
  }

  primaryAsset(entry: FleetOverviewCardEntry): string {
    return overviewPrimaryAsset(entry);
  }

  secondaryAsset(entry: FleetOverviewCardEntry): string {
    return overviewSecondaryAsset(entry);
  }

  renewalIconClass(bucket: FleetRenewalBucket): string {
    return fleetRenewalIconClass(bucket);
  }

  maintBucket(entry: FleetOverviewCardEntry): FleetRenewalBucket {
    return renewalBucketFromOverview(entry.maintenance?.maintenanceRenewal);
  }

  insBucket(entry: FleetOverviewCardEntry): FleetRenewalBucket {
    return renewalBucketFromOverview(entry.maintenance?.insuranceRenewal);
  }

  verifBucket(entry: FleetOverviewCardEntry): FleetRenewalBucket {
    return renewalBucketFromOverview(entry.maintenance?.inspectionRenewal);
  }

  readonly tripDeparture = overviewTripDepartureLine;
  readonly tripArrival = overviewTripArrivalLine;
  readonly tripCompletion = overviewTripCompletionLine;
  readonly tripEtaDays = overviewTripEtaDaysLabel;
  readonly tripEtaKm = overviewTripEtaKmLabel;
  readonly tripProgress = overviewTripProgress;
}
