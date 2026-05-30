import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { OperationConfigurationResolverService } from '@shared/services/operation-configuration-resolver.service';
import { TripEvaluationService } from '@shared/services/trip-evaluation.service';

/** Catálogo + evaluation (negocio) + resolver (UI) — capas separadas, mismo scope de página. */
export const TRIP_EVALUATION_PROVIDERS = [
  OperationConfigurationsFeatureService,
  TripEvaluationService,
  OperationConfigurationResolverService,
] as const;

export { OperationConfigurationsFeatureService, TripEvaluationService };
