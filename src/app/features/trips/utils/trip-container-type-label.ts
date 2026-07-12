import { tripContainerTypeLabelMx as labelFromCatalog } from '@shared/catalogs/trip-container-type-options';
import type { TripContainerType } from '@shared/models/logistics.models';

export function tripContainerTypeLabelMx(ct: TripContainerType | string | undefined): string {
  return labelFromCatalog(ct);
}
