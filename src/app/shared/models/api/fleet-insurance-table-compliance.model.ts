import type { FleetRenewalBucket } from '@features/fleet/utils/fleet-unit-table-row';

export type FleetTableInsuranceComplianceDto = {
  renewal: FleetRenewalBucket;
  nextLabel: string | null;
};

export type FleetInsuranceTableComplianceResponseDto = {
  units: Record<string, FleetTableInsuranceComplianceDto>;
  equipment: Record<string, FleetTableInsuranceComplianceDto>;
};
