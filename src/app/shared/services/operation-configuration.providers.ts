import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { OperationConfigurationResolverService } from './operation-configuration-resolver.service';

/** Proveer junto en páginas que muestran configuraciones operativas. */
export const OPERATION_CONFIGURATION_PROVIDERS = [
  OperationConfigurationsFeatureService,
  OperationConfigurationResolverService,
] as const;
