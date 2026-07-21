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
  const normalized = code.trim();
  if (normalized === 'card') {
    return 'Tarjeta (legado)';
  }
  return (
    EXPENSE_PAYMENT_METHOD_OPTIONS.find((o) => o.value === normalized)?.label ??
    normalized
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
  const fromExpense = e.tripManeuverCode?.trim();
  if (fromExpense) {
    return fromExpense;
  }
  return tripManeuverByTripId?.get(tid)?.trim() || '—';
}

/**
 * Unidad, equipo u operador según rubro (detalle y búsqueda; no sustituye maniobra).
 * Solo IDs crudos — usar `expenseFleetRelationLabel` para mostrar en UI.
 */
export function expenseFleetRelationCode(e: Expense): string {
  switch (e.kind) {
    case 'trip':
      return '—';
    case 'maintenance':
      if (e.relatedEquipmentId?.trim()) {
        return e.relatedEquipmentId.trim();
      }
      if (e.relatedUnitId?.trim()) {
        return e.relatedUnitId.trim();
      }
      return '—';
    case 'tires':
      return e.relatedUnitId?.trim() || '—';
    case 'insurance':
      if (e.relatedEquipmentId?.trim()) {
        return e.relatedEquipmentId.trim();
      }
      if (e.relatedUnitId?.trim()) {
        return e.relatedUnitId.trim();
      }
      return '—';
    case 'gps':
    case 'verification':
    case 'tenure_payment':
      return e.relatedUnitId?.trim() || e.relatedEquipmentId?.trim() || '—';
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
    case 'fuel':
    case 'tolls':
      return e.relatedUnitId?.trim() || '—';
    case 'per_diem':
    case 'lodging':
      return e.relatedOperatorId?.trim() || e.relatedUnitId?.trim() || '—';
    default:
      return '—';
  }
}

/** Texto legible para detalle de flota (verificación incluye tipo). */
export function expenseFleetRelationDetail(e: Expense): string {
  return expenseFleetRelationLabel(e);
}

/** Etiqueta legible de vínculo operativo; proviene de `fleetRelationLabel` en API. */
export function expenseFleetRelationLabel(e: Expense): string {
  const fromApi = e.fleetRelationLabel?.trim();
  if (fromApi) {
    return fromApi;
  }

  const code = expenseFleetRelationCode(e);
  if (code === '—') {
    return '—';
  }
  if (e.kind === 'verification' && e.verificationScope) {
    const v = verificationLabel(e.verificationScope);
    return v ? `${code} · ${v}` : code;
  }
  return code;
}

export {
  expenseConceptLabel,
  expenseRubroLabelForExpense,
} from '@features/expenses/utils/expense-rubro.util';
