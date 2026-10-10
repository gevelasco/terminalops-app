import type { Signal, WritableSignal } from '@angular/core';
import type { MaintenanceEntry } from '@shared/models/logistics.models';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import type { FleetRenewalBucket } from '@features/fleet/utils/fleet-unit-table-row';

/** Contrato mínimo compartido por facades de unidad y equipo en la pestaña Mantenimiento. */
export interface FleetDetailMaintSectionVm {
  formatYmd(iso: string | undefined): string;
  meta(): { lastMaintenanceDate?: string; tireCondition?: string } | undefined;
  badgeRenewalClass(bucket: FleetRenewalBucket): string;
  maintRenewalBucket(): FleetRenewalBucket;
  maintNext(): string;
  maintenanceUsesKm(): boolean;
  /** Unidades: próximo por km o calendario. Equipos: solo historial, sin próximo. */
  showsNextMaintenance(): boolean;
  maintKmRenewalBucket(): FleetRenewalBucket;
  maintenanceKmRemainingDisplay(): string;
  accumulatedOdometerKmLabel(): string;
  maintenanceKmCounterLabel(): string;
  canEditMaintenanceKmCounter(): boolean;
  editingMaintenanceKmCounter(): boolean;
  readonly editMaintenanceKmCounter: WritableSignal<string>;
  maintenanceKmCounterEditHint(): string | null;
  startEditMaintenanceKmCounter(): void;
  cancelEditMaintenanceKmCounter(): void;
  saveEditMaintenanceKmCounter(): void;
  tireConditionDisplayLabel(): string;
  canEditTireCondition(): boolean;
  editingTireCondition(): boolean;
  readonly tireConditionOptions: ToSelectOption[];
  readonly editTireCondition: WritableSignal<string>;
  startEditTireCondition(): void;
  cancelEditTireCondition(): void;
  saveEditTireCondition(): void;
  addingMaint(): boolean;
  canWriteFleet(): boolean;
  openNewMaint(): void;
  readonly detailTabSymbols: { viewBox: string; mant: string };
  readonly newMaintTypeOptions: ToSelectOption[];
  readonly newMaintType: WritableSignal<string>;
  readonly newMaintDate: WritableSignal<string>;
  readonly newMaintCost: WritableSignal<string>;
  readonly newMaintPaymentMethod: WritableSignal<string>;
  readonly newMaintPaymentMethodOptions: ToSelectOption[];
  readonly newMaintNotes: WritableSignal<string>;
  readonly newMaintFiles: Signal<readonly File[]>;
  newMaintMaxDate(): string | undefined;
  /** Aviso al elegir servicio completo con política por km (unidad vs equipo). */
  newMaintKmCounterResetHint(): string | null;
  onNewMaintFiles(event: Event): void;
  removeNewMaintFile(index: number): void;
  cancelNewMaint(): void;
  saveNewMaint(): void;
  maintenanceEntries(): MaintenanceEntry[];
  trackFileEntry(index: number, file: File): string;
  trackMaintenanceEntry(index: number, entry: MaintenanceEntry): string;
  formatTrackingAmount(n: number | undefined): string;
  formatMaintDateShort(iso: string | undefined): string;
  /** Opcional: descarga por nombre (resuelve id en fleetDocuments). Preferir arrow en facade. */
  downloadStoredDocument?(fileName: string): void;
}
