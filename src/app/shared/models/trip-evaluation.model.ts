import type { Equipment, Trip } from '@shared/models/logistics.models';

/** Contexto opcional para evaluación de maniobra. */
export interface TripEvaluationContext {
  equipmentById?: ReadonlyMap<string, Pick<Equipment, 'type' | 'fleetMeta'>>;
  /** Borrador — catálogo vivo, sin snapshots. */
  draftOperationConfigurationId?: string;
  draftOperationCode?: string;
  draftMaxEquipmentCount?: number;
}

export type TripMaxEquipmentMode = 'single' | 'multi';

export type TripDieselCostBasis = 'sencillo' | 'full';

/** Inputs estructurados para rentabilidad — sin strings de UI. */
export interface TripProfitabilityInputs {
  groupingKey: string;
  configurationCode: string;
  configurationId?: string;
  maxEquipmentCount: number;
  operationalDistanceKm: number;
  configurationVersion: number;
}

/**
 * Contrato inmutable de evaluación de negocio.
 * Solo datos estructurados — labels de reporte vía reportSliceLabel() del servicio.
 */
export interface TripEvaluationResult {
  groupingKey: string;
  configurationCode: string;
  configurationId?: string;
  configurationVersion: number;
  /** Dato histórico persistido en trip — no resolver. */
  configurationNameSnapshot?: string;
  dieselCostBasis: TripDieselCostBasis;
  operationalDistanceKm: number;
  maxEquipmentMode: TripMaxEquipmentMode;
  maxEquipmentCount: number;
  chartTone: number;
  suggestsPlataformaConvoy: boolean;
  tirePositions: number;
  profitabilityInputs: TripProfitabilityInputs;
}

/** @deprecated Usar TripEvaluationResult */
export type TripEvaluation = TripEvaluationResult;

export type TripEvaluationPick = Pick<
  Trip,
  | 'operationType'
  | 'operationConfigurationId'
  | 'operationConfigurationNameSnapshot'
  | 'operationConfigurationVersionSnapshot'
  | 'operationConfigurationMaxEquipmentCountSnapshot'
> &
  Partial<
    Pick<
      Trip,
      | 'routeDistanceKm'
      | 'maneuverKind'
      | 'equipment'
      | 'equipmentIds'
      | 'approximateWeightTons'
      | 'departureAt'
      | 'programmedAt'
    >
  >;

export interface TripEvaluator {
  evaluateTrip(trip: TripEvaluationPick, context?: TripEvaluationContext): TripEvaluationResult;
  reportSliceLabel(result: TripEvaluationResult): string;
  chartColorForResult(result: TripEvaluationResult): string;
  chartFillClass(tone: number, scope: 'dash' | 'reports'): string;
}
