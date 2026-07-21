import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { fleetRenewalIconClass } from '@features/fleet/utils/fleet-overview-card';
import {
  overviewAssetAt,
  overviewTrailerVisualAt,
  overviewTripArrivalLine,
  overviewTripDepartureLine,
  overviewUnitAsset,
  type FleetOverviewCardEntry,
} from '@features/fleet/utils/fleet-overview-view';
import {
  overviewTripEtaDaysLabel,
  overviewTripEtaKmLabel,
  overviewTripCompletionLine,
  overviewTripProgress,
} from '@features/fleet/utils/fleet-overview-trip-metrics';
import { formatTripRouteSummary } from '@features/trips/utils/trip-display-labels';
import type { FleetRenewalBucket } from '@features/fleet/utils/fleet-unit-table-row';
import type { FleetOverviewTripDto } from '@shared/models/api/fleet-overview.model';

@Component({
  selector: 'app-fleet-overview-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fleet-overview-card-host',
    '[class.fleet-overview-card-host--selectable]': 'tripSelectable()',
    '[attr.role]': 'tripSelectable() ? "button" : null',
    '[attr.tabindex]': 'tripSelectable() ? 0 : null',
    '(click)': 'onCardActivate()',
    '(keydown)': 'onCardKeydown($event)',
  },
  templateUrl: './fleet-overview-card.component.html',
  styleUrl: './fleet-overview-card.component.scss',
})
export class FleetOverviewCardComponent {
  readonly entry = input.required<FleetOverviewCardEntry>();
  readonly tripSelectable = input(false);
  /** Resumen unidad/equipo en panel lateral del mapa de maniobras. */
  readonly showAssignmentSummary = input(false);
  /** Clic en tracto/equipo del convoy (página Flota). */
  readonly convoyInteractive = input(false);
  /** Panel de mantenimiento cuando la unidad está estacionada. */
  readonly showMaintenanceAside = input(false);
  /** Pie de tarjeta para unidades disponibles / placeholder. */
  readonly showIdleFooter = input(false);
  /** `role="listitem"` dentro del grid de overview. */
  readonly overviewListItem = input(false);

  readonly tripSelect = output<string>();
  readonly unitActivate = output<FleetOverviewCardEntry>();
  readonly equipmentActivate = output<number>();

  unitAsset(entry: FleetOverviewCardEntry): string {
    return overviewUnitAsset(entry);
  }

  tripRouteLabel(trip: FleetOverviewTripDto): string {
    return formatTripRouteSummary(trip);
  }

  onCardActivate(): void {
    if (!this.tripSelectable()) {
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

  onUnitHit(event: Event): void {
    event.stopPropagation();
    if (!this.convoyInteractive()) {
      return;
    }
    this.unitActivate.emit(this.entry());
  }

  onEquipmentHit(event: Event, equipmentId: number): void {
    event.stopPropagation();
    if (!this.convoyInteractive()) {
      return;
    }
    this.equipmentActivate.emit(equipmentId);
  }

  convoyAriaLabel(): string {
    const entry = this.entry();
    if (entry.kind === 'standalone-equipment') {
      return 'Equipo disponible sin tractora';
    }
    if (this.isFull(entry)) {
      return 'Convoy: unidad y dos equipos';
    }
    if (entry.hitched.length === 0) {
      return 'Unidad sin equipos enganchados';
    }
    return 'Convoy: unidad y equipo';
  }

  scheduleAriaLabel(): string {
    const entry = this.entry();
    if (entry.panelMode === 'maneuver') {
      return 'Fechas de la maniobra';
    }
    return 'Mantenimiento y cumplimiento del activo';
  }

  renewalIconClass(bucket: FleetRenewalBucket): string {
    return fleetRenewalIconClass(bucket);
  }

  insBucket(): FleetRenewalBucket {
    return this.entry().compliance?.insBucket ?? 'na';
  }

  verifBucket(): FleetRenewalBucket {
    return this.entry().compliance?.verifBucket ?? 'na';
  }

  insLabel(): string {
    return this.entry().compliance?.insLabel ?? '—';
  }

  verifLabel(): string {
    return this.entry().compliance?.verifLabel ?? '—';
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

  usesCajaSeca(entry: FleetOverviewCardEntry): boolean {
    return entry.usesCajaSeca;
  }

  /** Clase de tamaño de la imagen del equipo según su tipo visual. */
  trailerClassAt(entry: FleetOverviewCardEntry, index: number): string {
    const visual = overviewTrailerVisualAt(entry, index);
    const modifier: Record<string, string> = {
      plataforma: 'plana',
      caja_seca: 'caja-seca',
      pipa: 'pipa',
      cortina: 'cortina',
      gondola: 'gondola',
      cama_baja: 'cama-baja',
      tolva: 'tolva',
      remolque: 'remolque',
    };
    return `fleet-overview__convoy-part fleet-overview__convoy-part--${modifier[visual] ?? 'remolque'}`;
  }

  trailerAlt(entry: FleetOverviewCardEntry, position: 'primary' | 'secondary'): string {
    const index = position === 'primary' ? 0 : 1;
    const visual = overviewTrailerVisualAt(entry, index);
    const nameByVisual: Record<string, string> = {
      plataforma: 'Plataforma',
      caja_seca: 'Caja seca',
      pipa: 'Pipa',
      cortina: 'Lona / cortina',
      gondola: 'Góndola',
      cama_baja: 'Cama baja',
      tolva: 'Tolva',
    };
    const name = nameByVisual[visual];
    if (name) {
      return position === 'primary' ? `${name} (primer equipo)` : `${name} (segundo equipo)`;
    }
    return position === 'primary' ? 'Equipo (delantero)' : 'Equipo (trasero)';
  }

  assetAt(entry: FleetOverviewCardEntry, index: number): string {
    return overviewAssetAt(entry, index);
  }

  readonly tripDeparture = overviewTripDepartureLine;
  readonly tripArrival = overviewTripArrivalLine;
  readonly tripCompletion = overviewTripCompletionLine;
  readonly tripEtaDays = overviewTripEtaDaysLabel;
  readonly tripEtaKm = overviewTripEtaKmLabel;
  readonly tripProgress = overviewTripProgress;

  maneuverEquipmentCodes(entry: FleetOverviewCardEntry): string {
    const codes = entry.hitched
      .map((h) => h.operationalCode.trim())
      .filter((code) => code.length > 0);
    if (codes.length === 0) {
      return '—';
    }
    return codes.join(', ');
  }
}
