import type {
  Expense,
  ExpenseKind,
  ExpenseMaintenanceTarget,
  ExpenseVerificationScope,
} from '@shared/models/logistics.models';

export function parseExpenseAmount(raw: string): number | 'invalid' {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '') {
    return 'invalid';
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    return 'invalid';
  }
  return n;
}

export function expenseIncurredDateInput(incurredAt: string): string {
  return expenseIncurredDateOperational(incurredAt);
}

/** Fecha operativa YYYY-MM-DD en zona horaria de México. */
export function expenseIncurredDateOperational(incurredAt: string): string {
  const trimmed = incurredAt.trim();
  if (!trimmed) {
    return '';
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Fecha operativa del gasto para tablas (sin hora). */
export function formatExpenseIncurredDateDisplay(
  incurredAt: string | null | undefined,
  incurredDate?: string | null,
): string {
  const ymd = (incurredDate ?? expenseIncurredDateOperational(incurredAt ?? '')).trim();
  if (!ymd) {
    return '—';
  }
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!parts) {
    return ymd;
  }
  const d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  if (Number.isNaN(d.getTime())) {
    return ymd;
  }
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short' }).format(d);
}

export function isExpenseEquipmentOnlyKind(k: ExpenseKind): boolean {
  return (
    k === 'equipment_purchase' ||
    k === 'equipment_rent' ||
    k === 'trailer_admin_payout'
  );
}

export function isExpenseUnitOnlyAssetKind(k: ExpenseKind): boolean {
  return k === 'unit_purchase' || k === 'unit_rent';
}

export function isExpenseOperatorKind(k: ExpenseKind): boolean {
  return k === 'operator_payment' || k === 'operator_commission';
}

export function isExpenseTiresKind(k: ExpenseKind): boolean {
  return k === 'tires';
}

export type ExpenseRelationFormState = {
  tripId: string;
  relatedUnitId: string;
  relatedEquipmentId: string;
  relatedOperatorId: string;
  verificationScope: ExpenseVerificationScope;
};

export type ExpenseRelationResolveResult =
  | {
      ok: true;
      fields: Pick<
        Expense,
        | 'tripId'
        | 'maintenanceTarget'
        | 'insuranceTarget'
        | 'relatedUnitId'
        | 'relatedEquipmentId'
        | 'relatedOperatorId'
        | 'verificationScope'
      >;
    }
  | { ok: false; message: string };

export function resolveExpenseRelationFields(
  kind: ExpenseKind,
  state: ExpenseRelationFormState,
): ExpenseRelationResolveResult {
  const tripId = state.tripId.trim();
  let maintenanceTarget: ExpenseMaintenanceTarget | undefined;
  let insuranceTarget: ExpenseMaintenanceTarget | undefined;
  let relatedUnitId: string | undefined;
  let relatedEquipmentId: string | undefined;
  let relatedOperatorId: string | undefined;
  let verificationScope: ExpenseVerificationScope | undefined;

  if (kind === 'maintenance') {
    const uid = state.relatedUnitId.trim();
    const eid = state.relatedEquipmentId.trim();
    if (uid && eid) {
      return {
        ok: false,
        message:
          'El mantenimiento solo puede vincularse a una unidad o a un equipo, no ambos.',
      };
    }
    if (uid) {
      maintenanceTarget = 'unit';
      relatedUnitId = uid;
    } else if (eid) {
      maintenanceTarget = 'equipment';
      relatedEquipmentId = eid;
    } else {
      return {
        ok: false,
        message: 'Selecciona la unidad o el equipo al que aplica el mantenimiento.',
      };
    }
  } else if (kind === 'insurance') {
    const uid = state.relatedUnitId.trim();
    const eid = state.relatedEquipmentId.trim();
    if (uid && eid) {
      return {
        ok: false,
        message:
          'El seguro solo puede vincularse a una unidad o a un equipo, no ambos.',
      };
    }
    if (uid) {
      insuranceTarget = 'unit';
      relatedUnitId = uid;
    } else if (eid) {
      insuranceTarget = 'equipment';
      relatedEquipmentId = eid;
    } else {
      return {
        ok: false,
        message: 'Selecciona la unidad o el equipo asegurado.',
      };
    }
  } else if (kind === 'gps') {
    const uid = state.relatedUnitId.trim();
    if (!uid) {
      return {
        ok: false,
        message: 'Selecciona la unidad con servicio de GPS.',
      };
    }
    relatedUnitId = uid;
  } else if (kind === 'verification') {
    const uid = state.relatedUnitId.trim();
    if (!uid) {
      return { ok: false, message: 'Selecciona la unidad verificada.' };
    }
    relatedUnitId = uid;
    verificationScope = state.verificationScope;
  } else if (kind === 'tires') {
    const uid = state.relatedUnitId.trim();
    if (!uid) {
      return {
        ok: false,
        message: 'Selecciona la unidad a la que aplican las llantas.',
      };
    }
    relatedUnitId = uid;
  } else if (isExpenseEquipmentOnlyKind(kind)) {
    const eid = state.relatedEquipmentId.trim();
    if (!eid) {
      return { ok: false, message: 'Selecciona el equipo.' };
    }
    relatedEquipmentId = eid;
  } else if (isExpenseUnitOnlyAssetKind(kind)) {
    const uid = state.relatedUnitId.trim();
    if (!uid) {
      return { ok: false, message: 'Selecciona la unidad.' };
    }
    relatedUnitId = uid;
  } else if (isExpenseOperatorKind(kind)) {
    const oid = state.relatedOperatorId.trim();
    if (!oid) {
      return { ok: false, message: 'Selecciona el operador.' };
    }
    relatedOperatorId = oid;
  }

  return {
    ok: true,
    fields: {
      tripId,
      maintenanceTarget,
      insuranceTarget,
      relatedUnitId: relatedUnitId ?? '',
      relatedEquipmentId: relatedEquipmentId ?? '',
      relatedOperatorId: relatedOperatorId ?? '',
      verificationScope,
    },
  };
}
