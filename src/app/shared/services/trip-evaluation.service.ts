import { Injectable, inject } from '@angular/core';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { parseApproxWeightTons } from '@features/trips/utils/trip-operational-provision';
import type {
  TripEvaluationContext,
  TripEvaluationPick,
  TripEvaluationResult,
  TripEvaluator,
} from '@shared/models/trip-evaluation.model';
import {
  chartColorForGroupingKey,
  chartFillClassForTone,
  evaluateDraftTrip,
  evaluatePersistedTrip,
  reportSliceLabel,
} from '@shared/utils/trip-evaluation.engine';

export type {
  TripDieselCostBasis,
  TripEvaluation,
  TripEvaluationContext,
  TripEvaluationPick,
  TripEvaluationResult,
  TripEvaluator,
  TripMaxEquipmentMode,
  TripProfitabilityInputs,
} from '@shared/models/trip-evaluation.model';

/**
 * Capa única de agregación operativa (diesel, costos, reportes).
 * Sin resolver — separación estricta UI vs negocio.
 */
@Injectable()
export class TripEvaluationService implements TripEvaluator {
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService, {
    optional: true,
  });

  evaluateTrip(
    trip: TripEvaluationPick,
    context: TripEvaluationContext = {},
  ): TripEvaluationResult {
    if (context.draftOperationCode) {
      return evaluateDraftTrip(context, this.operationConfigs?.configurations() ?? []);
    }
    return evaluatePersistedTrip(trip, context);
  }

  evaluateDraft(
    params: {
      operationConfigurationId?: string;
      operationCode: string;
      maxEquipmentCount?: number;
    },
    context: TripEvaluationContext = {},
  ): TripEvaluationResult {
    return evaluateDraftTrip(
      {
        ...context,
        draftOperationConfigurationId: params.operationConfigurationId,
        draftOperationCode: params.operationCode,
        draftMaxEquipmentCount: params.maxEquipmentCount,
      },
      this.operationConfigs?.configurations() ?? [],
    );
  }

  reportSliceLabel(result: TripEvaluationResult): string {
    return reportSliceLabel(result);
  }

  chartColorForResult(result: TripEvaluationResult): string {
    return chartColorForGroupingKey(result.groupingKey);
  }

  chartFillClass(tone: number, scope: 'dash' | 'reports'): string {
    return chartFillClassForTone(tone, scope);
  }

  parseWeightTons(raw: string | undefined): number {
    return parseApproxWeightTons(raw);
  }
}
