import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { MaintenanceEntry } from '@shared/models/logistics.models';
import {
  FLEET_DETAIL_DRAWER_TAB_IMPORTS,
  FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_1,
  FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2,
  FLEET_DETAIL_DRAWER_SHELL_STYLES,
} from '@features/fleet/components/fleet-detail-drawer.shared';
import type { FleetDetailMaintSectionVm } from './fleet-detail-maint-section.vm';

@Component({
  selector: 'app-fleet-detail-maint-section',
  standalone: true,
  imports: [...FLEET_DETAIL_DRAWER_TAB_IMPORTS],
  templateUrl: './fleet-detail-maint-section.component.html',
  styleUrls: [
    ...FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_1,
    '../fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetDetailMaintSectionComponent {
  // Structural typing: ambos facades de drawer implementan el contrato.
  readonly vm = input.required<FleetDetailMaintSectionVm & object>();
  readonly sectionId = input.required<string>();
  readonly popoverIdPrefix = input.required<string>();
  readonly odometerLabel = input('Kilometraje en tacómetro (aprox).');
  /** Remolques: sin odómetro ni km acumulados del tracto. */
  readonly showOdometer = input(true);

  private readonly expandedMaintKey = signal<string | null>(null);

  maintRowKey(index: number, entry: MaintenanceEntry): string {
    return `${index}:${this.vm().trackMaintenanceEntry(index, entry)}`;
  }

  isMaintRowExpanded(index: number, entry: MaintenanceEntry): boolean {
    return this.expandedMaintKey() === this.maintRowKey(index, entry);
  }

  toggleMaintRow(index: number, entry: MaintenanceEntry): void {
    const key = this.maintRowKey(index, entry);
    this.expandedMaintKey.update((current) => (current === key ? null : key));
  }

  onMaintRowKeydown(event: KeyboardEvent, index: number, entry: MaintenanceEntry): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button')) {
      return;
    }
    event.preventDefault();
    this.toggleMaintRow(index, entry);
  }

  onMaintDocsClick(event: Event, names: readonly string[]): void {
    event.stopPropagation();
    this.downloadMaintDocs(names);
  }

  maintCountLabel(): string {
    const count = this.vm().maintenanceEntries().length;
    return count === 1 ? '1 reparación' : `${count} reparaciones`;
  }

  maintCostTotal(): number {
    return this.vm().maintenanceEntries().reduce((sum, entry) => {
      const cost = entry.cost;
      return sum + (typeof cost === 'number' && Number.isFinite(cost) ? cost : 0);
    }, 0);
  }

  /** Descarga todos los comprobantes de la fila (sin popover nativo). */
  downloadMaintDocs(names: readonly string[]): void {
    const download = this.vm().downloadStoredDocument;
    if (!download || names.length === 0) {
      return;
    }
    for (const name of names) {
      const trimmed = name.trim();
      if (trimmed) {
        download(trimmed);
      }
    }
  }
}
