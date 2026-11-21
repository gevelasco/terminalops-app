import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  overviewAssetAt,
  overviewDoubleArticulatedLeadIndex,
  overviewDoubleArticulatedRearIndex,
  overviewSkipConvoyGraphicSegment,
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
import type { FleetOverviewTripDto } from '@shared/models/api/fleet-overview.model';
import { convoyOverviewHitchPositionLabel } from '@features/fleet/utils/unit-hitched-equipment';
import { FleetOverviewMaintAsideComponent } from '@features/fleet/components/fleet-overview-maint-aside/fleet-overview-maint-aside.component';
import { FleetOverviewManeuverAsideComponent } from '@features/fleet/components/fleet-overview-maneuver-aside/fleet-overview-maneuver-aside.component';
import { buildOverviewManeuverAsideView } from '@features/fleet/utils/fleet-overview-maneuver-aside.util';

@Component({
  selector: 'app-fleet-overview-card',
  standalone: true,
  imports: [FleetOverviewMaintAsideComponent, FleetOverviewManeuverAsideComponent],
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
    const compact = trip.origin?.trim();
    if (compact && compact !== '—' && !/^—\s*→\s*—$/.test(compact)) {
      return compact;
    }
    const destination = trip.destination?.trim();
    if (destination && destination !== '—') {
      return destination;
    }
    return '—';
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
    if (this.convoyUsesDollyLayout(entry)) {
      return 'Convoy doble articulado: unidad y dos remolques';
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
      dolly: 'dolly',
      remolque: 'remolque',
    };
    const base = `fleet-overview__convoy-part fleet-overview__convoy-part--${modifier[visual] ?? 'remolque'}`;
    const leadIx = overviewDoubleArticulatedLeadIndex(entry);
    const rearIx = overviewDoubleArticulatedRearIndex(entry);
    if (leadIx != null && index === leadIx) {
      return `${base} fleet-overview__convoy-part--hitch-right`;
    }
    if (rearIx != null && index === rearIx) {
      return `${base} fleet-overview__convoy-part--hitch-left`;
    }
    const hitch = this.isBeforeDolly(entry, index)
      ? ' fleet-overview__convoy-part--hitch-right'
      : this.isAfterDolly(entry, index)
        ? ' fleet-overview__convoy-part--hitch-left'
        : index === 0
          ? ' fleet-overview__convoy-part--hitch-right'
          : '';
    return base + hitch;
  }

  equipmentSegmentTitle(entry: FleetOverviewCardEntry, index: number): string {
    const total = entry.hitched.length;
    if (!entry.isFullConvoy && total === 1) {
      return 'Equipo';
    }
    return convoyOverviewHitchPositionLabel(index, total);
  }

  trailerAltAt(entry: FleetOverviewCardEntry, index: number): string {
    const visual = overviewTrailerVisualAt(entry, index);
    const nameByVisual: Record<string, string> = {
      plataforma: 'Plataforma',
      caja_seca: 'Caja seca',
      pipa: 'Pipa',
      cortina: 'Lona / cortina',
      gondola: 'Góndola',
      cama_baja: 'Cama baja',
      tolva: 'Tolva',
      dolly: 'Dolly',
    };
    const name = nameByVisual[visual] ?? 'Equipo';
    const position = this.equipmentSegmentTitle(entry, index);
    return `${name} (${position})`;
  }

  assetAt(entry: FleetOverviewCardEntry, index: number): string {
    return overviewAssetAt(entry, index);
  }

  isDollySegment(entry: FleetOverviewCardEntry, index: number): boolean {
    return overviewTrailerVisualAt(entry, index) === 'dolly';
  }

  isBeforeDolly(entry: FleetOverviewCardEntry, index: number): boolean {
    return !this.isDollySegment(entry, index) && this.isDollySegment(entry, index + 1);
  }

  isAfterDolly(entry: FleetOverviewCardEntry, index: number): boolean {
    return !this.isDollySegment(entry, index) && this.isDollySegment(entry, index - 1);
  }

  convoyUsesDollyLayout(entry: FleetOverviewCardEntry): boolean {
    return entry.hitched.some((_, i) => this.isDollySegment(entry, i));
  }

  serialDisplay(value: string | undefined | null): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  /** Dolly enganchado: ranura invisible entre remolques (tooltip / clic). */
  dollyConvoySlotSegment(entry: FleetOverviewCardEntry, index: number): boolean {
    return overviewSkipConvoyGraphicSegment(entry, index);
  }

  dollySlotHint(): string {
    return 'Dolly enganchado entre remolques. Pasa el cursor o haz clic para ver detalle.';
  }

  dollySlotAriaLabel(operationalCode: string): string {
    return `Dolly enganchado (${operationalCode})`;
  }

  isLeadTrailerGraphic(entry: FleetOverviewCardEntry, index: number): boolean {
    if (this.isBeforeDolly(entry, index)) {
      return true;
    }
    const leadIx = overviewDoubleArticulatedLeadIndex(entry);
    return leadIx != null && index === leadIx;
  }

  isRearTrailerGraphic(entry: FleetOverviewCardEntry, index: number): boolean {
    if (this.isAfterDolly(entry, index)) {
      return true;
    }
    const rearIx = overviewDoubleArticulatedRearIndex(entry);
    return rearIx != null && index === rearIx;
  }

  readonly tripDeparture = overviewTripDepartureLine;
  readonly tripArrival = overviewTripArrivalLine;
  readonly tripCompletion = overviewTripCompletionLine;
  readonly tripEtaDays = overviewTripEtaDaysLabel;
  readonly tripEtaKm = overviewTripEtaKmLabel;
  readonly tripProgress = overviewTripProgress;

  maneuverAsideView(trip: NonNullable<FleetOverviewCardEntry['trip']>) {
    const entry = this.entry();
    return buildOverviewManeuverAsideView({
      trip,
      unitName: entry.unitName,
      equipmentCodes: this.maneuverEquipmentCodes(entry),
      operatorName: trip.operatorName?.trim() || '—',
      etaDays: this.tripEtaDays(trip),
      etaKm: this.tripEtaKm(trip),
      showAssignment: this.showAssignmentSummary(),
    });
  }

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
