import type { Operator } from '@shared/models/logistics.models';
import { withoutFleetOperationalStatus } from '@shared/utils/fleet/fleet-write-payload-sanitize';

/** PATCH operador: excluye `status` (system-owned). */
export function buildOperatorPatchPayload(
  operator: Operator,
): Omit<Operator, 'status'> & { isActive: boolean } {
  return withoutFleetOperationalStatus({
    ...operator,
    isActive: operator.isActive !== false,
  }) as Omit<Operator, 'status'> & { isActive: boolean };
}
