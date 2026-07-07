import type {
  Expense,
  ExpenseKind,
  ExpenseMaintenanceTarget,
} from '@shared/models/logistics.models';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/** Rubro de alto nivel visible en listado y formularios. */
export type ExpenseRubro =
  | 'maniobra'
  | 'mantenimiento'
  | 'reparacion'
  | 'seguros'
  | 'gps'
  | 'administracion'
  | 'verificaciones'
  | 'gasto'
  | 'otro';

export const EXPENSE_CUSTOM_CONCEPT_ID = '__custom__';

export const EXPENSE_RUBRO_OPTIONS: ToSelectOption[] = [
  { value: 'maniobra', label: 'Maniobra' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'gps', label: 'GPS' },
  { value: 'administracion', label: 'Administración' },
  { value: 'verificaciones', label: 'Verificaciones' },
  { value: 'gasto', label: 'Gasto' },
  { value: 'otro', label: 'Otro' },
];

export type ExpenseConceptDefinition = {
  id: string;
  label: string;
  rubro: ExpenseRubro;
  kind: ExpenseKind;
  custom?: boolean;
};

/** Conceptos operativos (casetas, diésel, mecánico…). El `kind` interno alimenta relaciones y reportes. */
export const EXPENSE_CONCEPT_CATALOG: readonly ExpenseConceptDefinition[] = [
  { id: 'tolls', label: 'Casetas', rubro: 'maniobra', kind: 'tolls' },
  { id: 'fuel', label: 'Diésel / combustible', rubro: 'maniobra', kind: 'fuel' },
  { id: 'per_diem', label: 'Viáticos', rubro: 'maniobra', kind: 'per_diem' },
  { id: 'lodging', label: 'Hospedaje', rubro: 'maniobra', kind: 'lodging' },
  {
    id: 'operator_payment',
    label: 'Pago a operador',
    rubro: 'maniobra',
    kind: 'operator_payment',
  },
  {
    id: 'operator_commission',
    label: 'Comisión a operador',
    rubro: 'maniobra',
    kind: 'operator_commission',
  },
  {
    id: 'maniobra_custom',
    label: 'Otro (especificar)',
    rubro: 'maniobra',
    kind: 'trip',
    custom: true,
  },

  { id: 'mechanic', label: 'Mecánico', rubro: 'mantenimiento', kind: 'maintenance' },
  { id: 'electrical', label: 'Eléctrico', rubro: 'mantenimiento', kind: 'maintenance' },
  { id: 'tires', label: 'Llantas', rubro: 'mantenimiento', kind: 'tires' },
  {
    id: 'maintenance_custom',
    label: 'Otro (especificar)',
    rubro: 'mantenimiento',
    kind: 'maintenance',
    custom: true,
  },

  { id: 'repair', label: 'Reparación', rubro: 'reparacion', kind: 'repair' },
  {
    id: 'reparacion_custom',
    label: 'Otro (especificar)',
    rubro: 'reparacion',
    kind: 'repair',
    custom: true,
  },

  { id: 'insurance', label: 'Póliza / seguro', rubro: 'seguros', kind: 'insurance' },
  { id: 'gps', label: 'GPS / telemetría', rubro: 'gps', kind: 'gps' },
  {
    id: 'seguros_custom',
    label: 'Otro (especificar)',
    rubro: 'seguros',
    kind: 'insurance',
    custom: true,
  },
  {
    id: 'gps_custom',
    label: 'Otro (especificar)',
    rubro: 'gps',
    kind: 'gps',
    custom: true,
  },

  {
    id: 'unit_purchase',
    label: 'Compra de unidad',
    rubro: 'administracion',
    kind: 'unit_purchase',
  },
  {
    id: 'equipment_purchase',
    label: 'Compra de equipo',
    rubro: 'administracion',
    kind: 'equipment_purchase',
  },
  { id: 'unit_rent', label: 'Arriendo de unidad', rubro: 'administracion', kind: 'unit_rent' },
  {
    id: 'equipment_rent',
    label: 'Arriendo de equipo',
    rubro: 'administracion',
    kind: 'equipment_rent',
  },
  {
    id: 'trailer_admin_payout',
    label: 'Administración de equipo',
    rubro: 'administracion',
    kind: 'trailer_admin_payout',
  },
  {
    id: 'operational_control',
    label: 'Control operativo',
    rubro: 'administracion',
    kind: 'operational_control',
  },
  {
    id: 'administracion_custom',
    label: 'Otro (especificar)',
    rubro: 'administracion',
    kind: 'other',
    custom: true,
  },

  {
    id: 'verification',
    label: 'Verificación',
    rubro: 'verificaciones',
    kind: 'verification',
  },
  {
    id: 'verificaciones_custom',
    label: 'Otro (especificar)',
    rubro: 'verificaciones',
    kind: 'verification',
    custom: true,
  },

  {
    id: 'gasto_custom',
    label: 'Otro (especificar)',
    rubro: 'gasto',
    kind: 'other',
    custom: true,
  },

  { id: 'other', label: 'Otro', rubro: 'otro', kind: 'other' },
  {
    id: 'otro_custom',
    label: 'Otro (especificar)',
    rubro: 'otro',
    kind: 'other',
    custom: true,
  },
];

const RUBRO_LABELS: Record<ExpenseRubro, string> = {
  maniobra: 'Maniobra',
  mantenimiento: 'Mantenimiento',
  reparacion: 'Reparación',
  seguros: 'Seguros',
  gps: 'GPS',
  administracion: 'Administración',
  verificaciones: 'Verificaciones',
  gasto: 'Gasto',
  otro: 'Otro',
};

const MANIOBRA_KINDS = new Set<ExpenseKind>([
  'trip',
  'fuel',
  'tolls',
  'per_diem',
  'lodging',
  'operator_payment',
  'operator_commission',
]);

const KIND_DEFAULT_RUBRO = new Map<ExpenseKind, ExpenseRubro>([
  ['trip', 'maniobra'],
  ['fuel', 'maniobra'],
  ['tolls', 'maniobra'],
  ['per_diem', 'maniobra'],
  ['lodging', 'maniobra'],
  ['operator_payment', 'maniobra'],
  ['operator_commission', 'maniobra'],
  ['maintenance', 'mantenimiento'],
  ['repair', 'reparacion'],
  ['tires', 'mantenimiento'],
  ['verification', 'verificaciones'],
  ['insurance', 'seguros'],
  ['gps', 'gps'],
  ['unit_purchase', 'administracion'],
  ['equipment_purchase', 'administracion'],
  ['unit_rent', 'administracion'],
  ['equipment_rent', 'administracion'],
  ['trailer_admin_payout', 'administracion'],
  ['operational_control', 'administracion'],
  ['other', 'otro'],
]);

export function expenseRubroLabel(rubro: ExpenseRubro): string {
  return RUBRO_LABELS[rubro];
}

export function expenseConceptById(id: string): ExpenseConceptDefinition | undefined {
  return EXPENSE_CONCEPT_CATALOG.find((c) => c.id === id);
}

export function expenseConceptOptionsForRubro(rubro: ExpenseRubro): ToSelectOption[] {
  return EXPENSE_CONCEPT_CATALOG.filter((c) => c.rubro === rubro).map((c) => ({
    value: c.id,
    label: c.label,
  }));
}

export function defaultKindForRubro(rubro: ExpenseRubro): ExpenseKind {
  switch (rubro) {
    case 'maniobra':
      return 'trip';
    case 'mantenimiento':
      return 'maintenance';
    case 'reparacion':
      return 'repair';
    case 'seguros':
      return 'insurance';
    case 'gps':
      return 'gps';
    case 'administracion':
      return 'other';
    case 'verificaciones':
      return 'verification';
    case 'gasto':
      return 'other';
    default:
      return 'other';
  }
}

export function expenseRubroFromExpense(e: Expense): ExpenseRubro {
  const tripLinked = Boolean(e.tripId?.trim());
  if (tripLinked && MANIOBRA_KINDS.has(e.kind)) {
    return 'maniobra';
  }
  if (e.kind === 'operator_payment' || e.kind === 'operator_commission') {
    return 'maniobra';
  }
  return KIND_DEFAULT_RUBRO.get(e.kind) ?? 'gasto';
}

export function resolveExpenseConceptFromExpense(e: Expense): {
  rubro: ExpenseRubro;
  conceptId: string;
} {
  const rubro = expenseRubroFromExpense(e);
  const category = e.category.trim().toLowerCase();

  const byLabel = EXPENSE_CONCEPT_CATALOG.find(
    (c) =>
      c.rubro === rubro &&
      !c.custom &&
      c.label.trim().toLowerCase() === category,
  );
  if (byLabel) {
    return { rubro, conceptId: byLabel.id };
  }

  const byKind = EXPENSE_CONCEPT_CATALOG.find(
    (c) => c.rubro === rubro && !c.custom && c.kind === e.kind,
  );
  if (byKind) {
    return { rubro, conceptId: byKind.id };
  }

  const custom = EXPENSE_CONCEPT_CATALOG.find(
    (c) => c.rubro === rubro && c.custom,
  );
  return { rubro, conceptId: custom?.id ?? EXPENSE_CUSTOM_CONCEPT_ID };
}

export function expenseConceptLabel(e: Expense): string {
  const text = e.category?.trim();
  return text || '—';
}

export function expenseRubroLabelForExpense(e: Expense): string {
  return expenseRubroLabel(expenseRubroFromExpense(e));
}

export function isExpenseCustomConcept(conceptId: string): boolean {
  const concept = expenseConceptById(conceptId);
  return concept?.custom === true;
}

export function applyExpenseConceptSelection(
  conceptId: string,
): { kind: ExpenseKind; category: string | null } | null {
  const concept = expenseConceptById(conceptId);
  if (!concept) {
    return null;
  }
  return {
    kind: concept.kind,
    category: concept.custom ? null : concept.label,
  };
}

export function validateExpenseRubroTripLink(
  rubro: ExpenseRubro,
  tripId: string,
): string | null {
  if (rubro === 'maniobra' && !tripId.trim()) {
    return 'Los gastos de maniobra deben vincularse a una maniobra.';
  }
  return null;
}

/** Rubro de mantenimiento con concepto mecánico/eléctrico: target por defecto unidad. */
export function defaultMaintenanceTargetForConcept(
  conceptId: string,
): ExpenseMaintenanceTarget {
  if (conceptId === 'electrical' || conceptId === 'mechanic') {
    return 'unit';
  }
  return 'unit';
}
