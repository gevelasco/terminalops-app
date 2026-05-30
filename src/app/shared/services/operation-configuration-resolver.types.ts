import type { Equipment, Trip } from '@shared/models/logistics.models';
import type {
  OperationConfigCatalogEntry,
  UnitConvoyDisplay,
  UnitConvoyKind,
} from '@shared/utils/operation-configuration-display.utils';

/** Contexto de resolución — única entrada permitida a features. */
export interface OperationConfigurationContext {
  operationConfigurationId?: string | null;
  code?: string | null;
  nameSnapshot?: string | null;
  /** Solo informativa — no usar en lógica de resolución. */
  versionSnapshot?: number | null;
  maxEquipmentCountOverride?: number;
}

export interface OperationConfigurationDisplay {
  code: string;
  label: string;
  badgeClass: string;
  chartColor: string;
  groupingKey: string;
}

/** Contrato mínimo para reportes y utils que no pueden inyectar el servicio. */
export interface OperationConfigurationResolver {
  resolveLabel(ctx: OperationConfigurationContext): string;
  resolveColor(ctx: OperationConfigurationContext): string;
  resolveBadge(ctx: OperationConfigurationContext): string;
  resolveGroupingKey(ctx: OperationConfigurationContext): string;
  resolveMaxEquipment(ctx: OperationConfigurationContext): number;
  usesMultipleEquipment(ctx: OperationConfigurationContext): boolean;
  resolveConvoyMode(
    equipment: readonly Equipment[],
    configCtx?: OperationConfigurationContext,
  ): UnitConvoyKind;
  resolveConvoyDisplay(
    equipment: readonly Equipment[],
    configCtx?: OperationConfigurationContext,
  ): UnitConvoyDisplay;
  contextFromTrip(
    trip: Pick<
      Trip,
      | 'operationType'
      | 'operationConfigurationNameSnapshot'
      | 'operationConfigurationId'
      | 'operationConfigurationVersionSnapshot'
      | 'operationConfigurationMaxEquipmentCountSnapshot'
    >,
  ): OperationConfigurationContext;
  contextFromRatePrice(price: {
    operationConfigurationId?: string;
    operationConfigurationCode?: string;
    operationConfigurationName?: string;
  }): OperationConfigurationContext;
  contextFromTableRow(
    row: Record<string, unknown>,
    codeField?: string,
  ): OperationConfigurationContext;
  resolveTripDisplay(
    trip: Pick<
      Trip,
      'operationType' | 'operationConfigurationNameSnapshot' | 'operationConfigurationId'
    >,
  ): OperationConfigurationDisplay;
  resolveCellDisplay(
    code: unknown,
    row?: Record<string, unknown>,
  ): OperationConfigurationDisplay;
  resolveChartTone(groupingKey: string): number;
  resolveChartFillClass(tone: number, scope: 'dash' | 'reports'): string;
  resolveSuggestsPlataformaConvoy(ctx: OperationConfigurationContext): boolean;
}

export type { OperationConfigCatalogEntry, UnitConvoyDisplay, UnitConvoyKind };
