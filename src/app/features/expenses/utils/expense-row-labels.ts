import {
  EXPENSE_KIND_OPTIONS,
  EXPENSE_PAYMENT_METHOD_OPTIONS,
  EXPENSE_VERIFICATION_SCOPE_OPTIONS,
} from '@shared/catalogs/expense-form-options';
import type { Expense, ExpenseKind } from '@shared/models/logistics.models';

const LEGACY_KIND_LABELS: Partial<Record<ExpenseKind, string>> = {
  trip: 'Maniobra / viaje (legado)',
};

export function expenseKindLabel(kind: ExpenseKind): string {
  return (
    EXPENSE_KIND_OPTIONS.find((o) => o.value === kind)?.label ??
    LEGACY_KIND_LABELS[kind] ??
    kind
  );
}

export function expensePaymentMethodLabel(code: string | undefined): string {
  if (!code?.trim()) {
    return '—';
  }
  return (
    EXPENSE_PAYMENT_METHOD_OPTIONS.find((o) => o.value === code)?.label ?? code
  );
}

function verificationLabel(code: string | undefined): string {
  if (!code) {
    return '';
  }
  return (
    EXPENSE_VERIFICATION_SCOPE_OPTIONS.find((o) => o.value === code)?.label ??
    code
  );
}

/** Código de maniobra para la columna «Maniobra» (cualquier rubro con `tripId`). */
export function expenseManeuverCode(
  e: Expense,
  tripManeuverByTripId?: ReadonlyMap<string, string>,
): string {
  const tid = e.tripId?.trim();
  if (!tid) {
    return '—';
  }
  return tripManeuverByTripId?.get(tid)?.trim() || tid;
}

/**
 * Unidad, equipo u operador según rubro (detalle y búsqueda; no sustituye maniobra).
 */
export function expenseFleetRelationCode(e: Expense): string {
  switch (e.kind) {
    case 'trip':
      return '—';
    case 'maintenance':
      if (e.maintenanceTarget === 'unit') {
        return e.relatedUnitId?.trim() || '—';
      }
      if (e.maintenanceTarget === 'equipment') {
        return e.relatedEquipmentId?.trim() || '—';
      }
      return '—';
    case 'insurance':
      if (e.insuranceTarget === 'unit') {
        return e.relatedUnitId?.trim() || '—';
      }
      if (e.insuranceTarget === 'equipment') {
        return e.relatedEquipmentId?.trim() || '—';
      }
      return '—';
    case 'gps':
    case 'verification':
      return e.relatedUnitId?.trim() || '—';
    case 'equipment_purchase':
    case 'equipment_rent':
    case 'trailer_admin_payout':
      return e.relatedEquipmentId?.trim() || '—';
    case 'unit_purchase':
    case 'unit_rent':
      return e.relatedUnitId?.trim() || '—';
    case 'operator_payment':
    case 'operator_commission':
      return e.relatedOperatorId?.trim() || '—';
    default:
      return '—';
  }
}

/** @deprecated Use `expenseManeuverCode` / `expenseFleetRelationCode`. */
export function expenseRelationCode(
  e: Expense,
  tripManeuverByTripId?: ReadonlyMap<string, string>,
): string {
  const maneuver = expenseManeuverCode(e, tripManeuverByTripId);
  if (maneuver !== '—') {
    return maneuver;
  }
  return expenseFleetRelationCode(e);
}

/** Texto legible para detalle de flota (verificación incluye tipo). */
export function expenseFleetRelationDetail(e: Expense): string {
  const code = expenseFleetRelationCode(e);
  if (e.kind === 'verification' && e.verificationScope) {
    const v = verificationLabel(e.verificationScope);
    return code !== '—' && v ? `${code} · ${v}` : code;
  }
  return code;
}

/** @deprecated Use `expenseFleetRelationDetail`. */
export function expenseRelationDetail(
  e: Expense,
  tripManeuverByTripId?: ReadonlyMap<string, string>,
): string {
  const maneuver = expenseManeuverCode(e, tripManeuverByTripId);
  if (maneuver !== '—') {
    return maneuver;
  }
  return expenseFleetRelationDetail(e);
}
