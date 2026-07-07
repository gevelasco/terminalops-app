import type { ExpenseCalendarItem } from '@services/api/expenses';
import type {
  Expense,
  ExpenseKind,
  ExpenseMaintenanceTarget,
  ExpenseVerificationScope,
} from '@shared/models/logistics.models';

const PROJECTED_ENTRY_ID_PREFIXES = [
  'trip:',
  'unit:',
  'equipment:',
  'operator:',
] as const;

/** IDs sintéticos del calendario (no persistidos en ledger). */
export function isProjectedCalendarExpenseId(id: string | undefined): boolean {
  const normalized = id?.trim() ?? '';
  if (!normalized) {
    return false;
  }
  return PROJECTED_ENTRY_ID_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function insuranceTargetForProjected(
  relatedUnitId: number | null,
  relatedEquipmentId: number | null,
): ExpenseMaintenanceTarget | undefined {
  if (relatedUnitId != null) {
    return 'unit';
  }
  if (relatedEquipmentId != null) {
    return 'equipment';
  }
  return undefined;
}

/** Vista de detalle para filas proyectadas del calendario (solo lectura). */
export function expenseFromProjectedCalendarItem(item: ExpenseCalendarItem): Expense | null {
  const projected = item.projected;
  if (!projected || item.entryType !== 'projected') {
    return null;
  }

  const kind = projected.kind as ExpenseKind;
  const insuranceTarget = insuranceTargetForProjected(
    projected.relatedUnitId,
    projected.relatedEquipmentId,
  );

  return {
    id: item.id,
    tripId: projected.tripId != null ? String(projected.tripId) : '',
    tripManeuverCode: projected.tripManeuverCode,
    category: item.conceptLabel,
    amount: typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0,
    currency: item.currency,
    incurredAt: `${item.dateYmd}T12:00:00-06:00`,
    incurredDate: item.dateYmd,
    kind,
    description: projected.hint,
    fleetRelationLabel: projected.fleetRelationLabel,
    relatedUnitLabel: projected.relatedUnitLabel,
    relatedEquipmentLabel: projected.relatedEquipmentLabel,
    relatedOperatorLabel: projected.relatedOperatorLabel,
    paymentMethod: projected.paymentMethod,
    vendor: projected.vendor,
    invoiceRequired: projected.invoiceRequired,
    ...(projected.relatedUnitId != null
      ? { relatedUnitId: String(projected.relatedUnitId) }
      : {}),
    ...(projected.relatedEquipmentId != null
      ? { relatedEquipmentId: String(projected.relatedEquipmentId) }
      : {}),
    ...(projected.relatedOperatorId != null
      ? { relatedOperatorId: String(projected.relatedOperatorId) }
      : {}),
    ...(insuranceTarget ? { insuranceTarget } : {}),
    ...(projected.verificationScope
      ? { verificationScope: projected.verificationScope as ExpenseVerificationScope }
      : {}),
  };
}
