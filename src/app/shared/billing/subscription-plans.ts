/**
 * Catálogo comercial + reglas de entitlement de TerminalOps.
 * Fuente única administrable en front; más adelante puede vivir en DB/API.
 *
 * Precios en MXN (mensual). Los `entitlements` son los que aplica el producto;
 * `limits` / `features` son copy de marketing en /register.
 */

import { FLEET_TRAILER_TENURE_OPTIONS } from '@shared/catalogs/fleet-form-options';
import type { TrailerTenureMode } from '@shared/models/logistics.models';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

export type SubscriptionPlanId = 'basic' | 'standard' | 'pro';

export interface SubscriptionPlanLimit {
  label: string;
  value: string;
}

export interface SubscriptionPlanFeature {
  label: string;
  included: boolean;
  /** Texto corto opcional (p. ej. “próximamente”). */
  note?: string;
}

/** Límites y flags que el producto debe respetar. */
export interface PlanEntitlements {
  maxUnits: number;
  maxEquipment: number;
  maxOperators: number;
  /** null = sin tope mensual. */
  maxTripsPerMonth: number | null;
  /** Cupo de administradores (además del owner/superadmin si aplica). */
  maxAdmins: number;
  /** Cupo de usuarios staff. */
  maxStaffUsers: number;
  storageGb: number;
  dieselAutomatic: boolean;
  maintenancePolicy: boolean;
  /** Si false, solo tenencia `owned`. */
  advancedTenure: boolean;
  clientPortal: boolean;
  whatsappIntegration: boolean;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  audience: string;
  /** Precio mensual en MXN (sin IVA). */
  priceMxnMonthly: number;
  /** Referencia aproximada en USD para comparar con TMS internacionales. */
  priceUsdApprox: number;
  currencyNote: string;
  /** Si false, el plan se muestra pero no se puede contratar aún. */
  signupEnabled: boolean;
  /** Registro solo con código de invitación. */
  requiresInvitation: boolean;
  ctaLabel: string;
  disabledHint?: string;
  limits: SubscriptionPlanLimit[];
  features: SubscriptionPlanFeature[];
  entitlements: PlanEntitlements;
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Básico',
    tagline: 'Operación esencial para flotas que comienzan',
    audience: '1 – 3 unidades · dueño-operador o terminal pequeña',
    priceMxnMonthly: 1499,
    priceUsdApprox: 83,
    currencyNote: 'MXN / mes · + IVA',
    signupEnabled: true,
    requiresInvitation: true,
    ctaLabel: 'Registrarse con invitación',
    limits: [
      { label: 'Unidades', value: '1 – 3' },
      { label: 'Equipos', value: '1 – 6' },
      { label: 'Operadores', value: '1 – 5' },
      { label: 'Maniobras', value: '30 / mes' },
      { label: 'Usuarios', value: '1 admin + 1 staff' },
      { label: 'Clientes', value: 'Ilimitados' },
      { label: 'Gastos y reportes', value: 'Ilimitados' },
      { label: 'Almacenamiento', value: '2 GB' },
    ],
    features: [
      { label: 'Maniobras, clientes y tarifas', included: true },
      { label: 'Gastos y reportes operativos', included: true },
      { label: 'Administración de seguro, GPS y verificaciones', included: true },
      { label: 'Soporte por correo', included: true },
    ],
    entitlements: {
      maxUnits: 3,
      maxEquipment: 6,
      maxOperators: 5,
      maxTripsPerMonth: 30,
      maxAdmins: 1,
      maxStaffUsers: 1,
      storageGb: 2,
      dieselAutomatic: false,
      maintenancePolicy: false,
      advancedTenure: false,
      clientPortal: false,
      whatsappIntegration: false,
    },
  },
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'Control completo para flotas en crecimiento',
    audience: '4 – 15 unidades · operación con staff y costos',
    priceMxnMonthly: 3999,
    priceUsdApprox: 221,
    currencyNote: 'MXN / mes · + IVA',
    signupEnabled: false,
    requiresInvitation: false,
    ctaLabel: 'Próximamente',
    disabledHint: 'Apertura de ventas en breve',
    limits: [
      { label: 'Unidades', value: '4 – 15' },
      { label: 'Equipos', value: 'Hasta 30' },
      { label: 'Operadores', value: 'Hasta 20' },
      { label: 'Maniobras', value: '250 / mes' },
      { label: 'Usuarios', value: '1 admin + 5 staff' },
      { label: 'Clientes', value: 'Ilimitados' },
      { label: 'Gastos y reportes', value: 'Avanzados' },
      { label: 'Almacenamiento', value: '15 GB' },
    ],
    features: [
      { label: 'Todo lo del Básico', included: true },
      { label: 'Diésel automático', included: true },
      { label: 'Política de mantenimiento', included: true },
      {
        label: 'Tenencia: propio, financiado, arrendado o administrado',
        included: true,
      },
      { label: 'Soporte prioritario (correo + chat)', included: true },
    ],
    entitlements: {
      maxUnits: 15,
      maxEquipment: 30,
      maxOperators: 20,
      maxTripsPerMonth: 250,
      maxAdmins: 1,
      maxStaffUsers: 5,
      storageGb: 15,
      dieselAutomatic: true,
      maintenancePolicy: true,
      advancedTenure: true,
      clientPortal: false,
      whatsappIntegration: false,
    },
  },
  {
    id: 'pro',
    name: 'Pro +',
    tagline: 'Escala empresarial y visibilidad al cliente',
    audience: '16 – 50 unidades (pensado para 20+)',
    priceMxnMonthly: 7499,
    priceUsdApprox: 415,
    currencyNote: 'MXN / mes · + IVA',
    signupEnabled: false,
    requiresInvitation: false,
    ctaLabel: 'Próximamente',
    disabledHint: 'Incluirá WhatsApp y portal cliente',
    limits: [
      { label: 'Unidades', value: '16 – 50' },
      { label: 'Equipos', value: 'Hasta 100' },
      { label: 'Operadores', value: 'Hasta 50' },
      { label: 'Maniobras', value: 'Ilimitadas*' },
      { label: 'Usuarios', value: '1 admin + 15 staff' },
      { label: 'Clientes', value: 'Ilimitados' },
      { label: 'Gastos y reportes', value: 'Avanzados + export' },
      { label: 'Almacenamiento', value: '50 GB' },
    ],
    features: [
      { label: 'Todo lo del Standard', included: true },
      { label: 'Soporte prioritario dedicado', included: true },
      {
        label: 'Portal del cliente (estatus, saldos, bitácora)',
        included: true,
        note: 'Próximamente',
      },
      {
        label: 'Integración WhatsApp',
        included: true,
        note: 'Próximamente',
      },
      { label: 'Roles y permisos ampliados', included: true },
    ],
    entitlements: {
      maxUnits: 50,
      maxEquipment: 100,
      maxOperators: 50,
      maxTripsPerMonth: null,
      maxAdmins: 1,
      maxStaffUsers: 15,
      storageGb: 50,
      dieselAutomatic: true,
      maintenancePolicy: true,
      advancedTenure: true,
      clientPortal: true,
      whatsappIntegration: true,
    },
  },
] as const;

const PLAN_BY_ID = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((p) => [p.id, p]),
) as Record<SubscriptionPlanId, SubscriptionPlan>;

const LEGACY_PLAN_ALIASES: Record<string, SubscriptionPlanId> = {
  basic: 'basic',
  starter: 'basic',
  trial: 'basic',
  standard: 'standard',
  professional: 'standard',
  pro: 'pro',
  'pro+': 'pro',
  enterprise: 'pro',
};

export function formatPlanPriceMxn(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Normaliza IDs legacy de API (`starter`, `professional`, …) al catálogo actual. */
export function normalizeSubscriptionPlanId(
  raw: string | null | undefined,
): SubscriptionPlanId {
  if (!raw?.trim()) {
    return 'basic';
  }
  const key = raw.trim().toLowerCase();
  return LEGACY_PLAN_ALIASES[key] ?? 'basic';
}

export function getSubscriptionPlan(id: SubscriptionPlanId): SubscriptionPlan {
  return PLAN_BY_ID[id] ?? PLAN_BY_ID.basic;
}

export function getPlanEntitlements(id: SubscriptionPlanId): PlanEntitlements {
  return getSubscriptionPlan(id).entitlements;
}

export function planDisplayName(raw: string | null | undefined): string {
  return getSubscriptionPlan(normalizeSubscriptionPlanId(raw)).name;
}

export function allowedTenureModesForPlan(
  entitlements: PlanEntitlements,
): readonly TrailerTenureMode[] {
  if (entitlements.advancedTenure) {
    return ['owned', 'financed', 'leased', 'managed'];
  }
  return ['owned'];
}

export function tenureSelectOptionsForPlan(
  entitlements: PlanEntitlements,
): ToSelectOption[] {
  const allowed = new Set(allowedTenureModesForPlan(entitlements));
  return FLEET_TRAILER_TENURE_OPTIONS.filter((o) =>
    allowed.has(o.value as TrailerTenureMode),
  );
}

export function isTripInCurrentMonth(isoDate: string, now = new Date()): boolean {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
