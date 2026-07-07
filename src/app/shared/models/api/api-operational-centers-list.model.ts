import type { DashboardDieselSnapshot } from '@shared/models/api/api-dashboard-summary.model';
import type { OperationalCenter } from '@shared/models/operational-center.models';

export type OperationalCentersListResponse = {
  centers: OperationalCenter[];
  dieselReferencePrice: DashboardDieselSnapshot;
};
