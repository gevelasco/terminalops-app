import { Injectable, computed, inject } from '@angular/core';
import { SessionService } from '@core/services/state/session';
import {
  getPlanEntitlements,
  getSubscriptionPlan,
  isTripInCurrentMonth,
  normalizeSubscriptionPlanId,
  tenureSelectOptionsForPlan,
  type PlanEntitlements,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from '@shared/billing/subscription-plans';
import type { TrailerTenureMode } from '@shared/models/logistics.models';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/**
 * Aplica las reglas del plan de la empresa (desde `SUBSCRIPTION_PLANS`).
 * El plan llega en el login (`user.subscriptionPlan` ← companies.subscription_plan).
 * No hace requests extra: /account solo se usa en la página de Cuenta.
 */
@Injectable({ providedIn: 'root' })
export class PlanEntitlementService {
  private readonly session = inject(SessionService);

  readonly planId = computed<SubscriptionPlanId>(() =>
    normalizeSubscriptionPlanId(this.session.subscriptionPlanId()),
  );

  readonly plan = computed<SubscriptionPlan>(() => getSubscriptionPlan(this.planId()));

  readonly entitlements = computed<PlanEntitlements>(() =>
    getPlanEntitlements(this.planId()),
  );

  readonly planName = computed(() => this.plan().name);

  readonly tenureOptions = computed<ToSelectOption[]>(() =>
    tenureSelectOptionsForPlan(this.entitlements()),
  );

  readonly canUseDieselAutomatic = computed(
    () => this.entitlements().dieselAutomatic,
  );

  readonly canUseMaintenancePolicy = computed(
    () => this.entitlements().maintenancePolicy,
  );

  readonly canUseAdvancedTenure = computed(
    () => this.entitlements().advancedTenure,
  );

  /** Diesel efectivo: plan lo permite Y la empresa lo tiene activo. */
  effectiveDieselControlEnabled(): boolean {
    return this.canUseDieselAutomatic() && this.session.dieselControlEnabled();
  }

  effectiveMaintenanceKmEnabled(): boolean {
    return (
      this.canUseMaintenancePolicy() && this.session.maintenanceKmControlEnabled()
    );
  }

  effectiveMaintenanceDateEnabled(): boolean {
    return (
      this.canUseMaintenancePolicy() && this.session.maintenanceDateControlEnabled()
    );
  }

  /** No-op: el plan vive en sesión desde el login. */
  reset(): void {
    /* reserved for logout symmetry */
  }

  canAddUnit(currentCount: number): boolean {
    return currentCount < this.entitlements().maxUnits;
  }

  canAddEquipment(currentCount: number): boolean {
    return currentCount < this.entitlements().maxEquipment;
  }

  canAddOperator(currentCount: number): boolean {
    return currentCount < this.entitlements().maxOperators;
  }

  canAddTripThisMonth(tripsThisMonth: number): boolean {
    const max = this.entitlements().maxTripsPerMonth;
    if (max == null) {
      return true;
    }
    return tripsThisMonth < max;
  }

  canAddAdmin(currentAdminCount: number): boolean {
    return currentAdminCount < this.entitlements().maxAdmins;
  }

  canAddStaff(currentStaffCount: number): boolean {
    return currentStaffCount < this.entitlements().maxStaffUsers;
  }

  isTenureModeAllowed(mode: TrailerTenureMode): boolean {
    if (mode === 'owned') {
      return true;
    }
    return this.canUseAdvancedTenure();
  }

  countTripsInCurrentMonth(
    trips: ReadonlyArray<{ createdAt?: string; plannedDepartureAt?: string }>,
  ): number {
    return trips.filter((t) => {
      const iso = t.createdAt || t.plannedDepartureAt || '';
      return iso ? isTripInCurrentMonth(iso) : false;
    }).length;
  }

  unitLimitMessage(): string {
    const e = this.entitlements();
    return `Tu plan ${this.planName()} permite hasta ${e.maxUnits} unidades. Amplía tu plan para agregar más.`;
  }

  equipmentLimitMessage(): string {
    const e = this.entitlements();
    return `Tu plan ${this.planName()} permite hasta ${e.maxEquipment} equipos. Amplía tu plan para agregar más.`;
  }

  operatorLimitMessage(): string {
    const e = this.entitlements();
    return `Tu plan ${this.planName()} permite hasta ${e.maxOperators} operadores. Amplía tu plan para agregar más.`;
  }

  tripLimitMessage(): string {
    const max = this.entitlements().maxTripsPerMonth;
    if (max == null) {
      return '';
    }
    return `Tu plan ${this.planName()} permite hasta ${max} maniobras este mes. Amplía tu plan para continuar.`;
  }

  adminLimitMessage(): string {
    const e = this.entitlements();
    return `Tu plan ${this.planName()} permite hasta ${e.maxAdmins} administrador(es). Amplía tu plan para agregar más.`;
  }

  staffLimitMessage(): string {
    const e = this.entitlements();
    return `Tu plan ${this.planName()} permite hasta ${e.maxStaffUsers} usuario(s) staff. Amplía tu plan para agregar más.`;
  }

  dieselUpgradeMessage(): string {
    return `Diésel automático está disponible desde el plan Standard. Tu plan actual es ${this.planName()}.`;
  }

  maintenanceUpgradeMessage(): string {
    return `La política de mantenimiento está disponible desde el plan Standard. Tu plan actual es ${this.planName()}.`;
  }

  tenureUpgradeMessage(): string {
    return `Financiado, arrendado y administrado están disponibles desde Standard. En ${this.planName()} solo se permite tenencia propia.`;
  }
}
