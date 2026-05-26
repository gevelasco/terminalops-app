import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { formatUnitTrailerOperationalId } from '@shared/utils/fleet/unit-label';
import { ToastService } from '@core/notifications/toast.service';
import { EquipmentService } from '@services/api/equipment';
import { UnitsService } from '@services/api/units';
import { ExpensesService } from '@services/api/expenses';
import { OperatorsService } from '@services/api/operators';
import {
  EXPENSE_CURRENCY_OPTIONS,
  EXPENSE_INSURANCE_TARGET_OPTIONS,
  EXPENSE_KIND_OPTIONS,
  EXPENSE_MAINTENANCE_TARGET_OPTIONS,
  EXPENSE_PAYMENT_METHOD_OPTIONS,
  EXPENSE_VERIFICATION_SCOPE_OPTIONS,
} from '@shared/catalogs/expense-form-options';
import type {
  Expense,
  ExpenseKind,
  ExpenseMaintenanceTarget,
  ExpenseVerificationScope,
} from '@shared/models/logistics.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';
import { ToTripInputComponent } from '@shared/ui/to-trip-input/to-trip-input.component';

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function parseAmount(raw: string): number | 'invalid' {
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

@Component({
  selector: 'app-expenses-new-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ToButtonComponent,
    ToInputComponent,
    ToSelectComponent,
    ToSideDrawerComponent,
    ToTextareaComponent,
    ToTripInputComponent,
  ],
  templateUrl: './expenses-new-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    './expenses-new-drawer.component.scss',
  ],
})
export class ExpensesNewDrawerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly expensesApi = inject(ExpensesService);
  private readonly unitsApi = inject(UnitsService);
  private readonly equipmentApi = inject(EquipmentService);
  private readonly operatorsApi = inject(OperatorsService);

  readonly dismiss = output<void>();
  readonly saved = output<Expense>();

  readonly kindOptions = EXPENSE_KIND_OPTIONS;
  readonly maintenanceTargetOptions = EXPENSE_MAINTENANCE_TARGET_OPTIONS;
  readonly insuranceTargetOptions = EXPENSE_INSURANCE_TARGET_OPTIONS;
  readonly verificationScopeOptions = EXPENSE_VERIFICATION_SCOPE_OPTIONS;
  readonly paymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS;
  readonly currencyOptions = EXPENSE_CURRENCY_OPTIONS;

  readonly unitOptions = signal<ToSelectOption[]>([]);
  readonly equipmentOptions = signal<ToSelectOption[]>([]);
  readonly operatorOptions = signal<ToSelectOption[]>([]);

  readonly kind = model<ExpenseKind>('other');
  readonly category = model('');
  readonly description = model('');
  readonly vendor = model('');
  readonly amountStr = model('');
  readonly currency = model('MXN');
  readonly paymentMethod = model('');
  readonly incurredAt = model(todayYmd());
  readonly invoiceRequired = model(false);

  readonly tripId = model('');
  readonly maintenanceTarget = model<ExpenseMaintenanceTarget>('unit');
  readonly insuranceTarget = model<ExpenseMaintenanceTarget>('unit');
  readonly relatedUnitId = model('');
  readonly relatedEquipmentId = model('');
  readonly relatedOperatorId = model('');
  readonly verificationScope = model<ExpenseVerificationScope>('phys_mech');

  readonly drawerLoading = signal(true);

  constructor() {
    forkJoin({
      units: this.unitsApi.getUnitsList(),
      equipment: this.equipmentApi.getEquipmentList(),
      operators: this.operatorsApi.getOperatorsList(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ units, equipment, operators }) => {
        this.unitOptions.set([
          { value: '', label: '— Seleccionar unidad —' },
          ...units.map((u) => ({
            value: u.id,
            label: formatUnitTrailerOperationalId(u),
          })),
        ]);
        this.equipmentOptions.set([
          { value: '', label: '— Seleccionar equipo —' },
          ...equipment.map((eq) => ({
            value: eq.id,
            label: formatEquipmentOperationalId(eq),
          })),
        ]);
        this.operatorOptions.set([
          { value: '', label: '— Seleccionar operador —' },
          ...operators.map((o) => ({
            value: o.id,
            label: o.name,
          })),
        ]);
        this.drawerLoading.set(false);
        },
        error: () => this.drawerLoading.set(false),
      });
  }

  isEquipmentOnlyKind(k: ExpenseKind): boolean {
    return (
      k === 'equipment_purchase' ||
      k === 'equipment_rent' ||
      k === 'trailer_admin_payout'
    );
  }

  isUnitOnlyAssetKind(k: ExpenseKind): boolean {
    return k === 'unit_purchase' || k === 'unit_rent';
  }

  isOperatorKind(k: ExpenseKind): boolean {
    return k === 'operator_payment' || k === 'operator_commission';
  }

  submit(): void {
    const categoryText = this.category().trim();
    if (!categoryText) {
      this.toast.show('Indica un concepto o categoría.', 'warning');
      return;
    }
    const amountResult = parseAmount(this.amountStr());
    if (amountResult === 'invalid') {
      this.toast.show('Indica un monto válido (≥ 0).', 'warning');
      return;
    }
    const date = this.incurredAt().trim();
    if (!date) {
      this.toast.show('Indica la fecha del gasto.', 'warning');
      return;
    }

    const kind = this.kind();
    const tripId = this.tripId().trim();
    let maintenanceTarget: ExpenseMaintenanceTarget | undefined;
    let insuranceTarget: ExpenseMaintenanceTarget | undefined;
    let relatedUnitId: string | undefined;
    let relatedEquipmentId: string | undefined;
    let relatedOperatorId: string | undefined;
    let verificationScope: ExpenseVerificationScope | undefined;

    if (kind === 'maintenance') {
      const target = this.maintenanceTarget();
      maintenanceTarget = target;
      if (target === 'unit') {
        const uid = this.relatedUnitId().trim();
        if (!uid) {
          this.toast.show(
            'Selecciona la unidad a la que aplica el mantenimiento.',
            'warning',
          );
          return;
        }
        relatedUnitId = uid;
      } else {
        const eid = this.relatedEquipmentId().trim();
        if (!eid) {
          this.toast.show(
            'Selecciona el equipo al que aplica el mantenimiento.',
            'warning',
          );
          return;
        }
        relatedEquipmentId = eid;
      }
    } else if (kind === 'insurance') {
      const target = this.insuranceTarget();
      insuranceTarget = target;
      if (target === 'unit') {
        const uid = this.relatedUnitId().trim();
        if (!uid) {
          this.toast.show('Selecciona la unidad asegurada.', 'warning');
          return;
        }
        relatedUnitId = uid;
      } else {
        const eid = this.relatedEquipmentId().trim();
        if (!eid) {
          this.toast.show('Selecciona el equipo asegurado.', 'warning');
          return;
        }
        relatedEquipmentId = eid;
      }
    } else if (kind === 'gps') {
      const uid = this.relatedUnitId().trim();
      if (!uid) {
        this.toast.show('Selecciona la unidad con servicio de GPS.', 'warning');
        return;
      }
      relatedUnitId = uid;
    } else if (kind === 'verification') {
      const uid = this.relatedUnitId().trim();
      if (!uid) {
        this.toast.show('Selecciona la unidad verificada.', 'warning');
        return;
      }
      relatedUnitId = uid;
      verificationScope = this.verificationScope();
    } else if (this.isEquipmentOnlyKind(kind)) {
      const eid = this.relatedEquipmentId().trim();
      if (!eid) {
        this.toast.show('Selecciona el equipo.', 'warning');
        return;
      }
      relatedEquipmentId = eid;
    } else if (this.isUnitOnlyAssetKind(kind)) {
      const uid = this.relatedUnitId().trim();
      if (!uid) {
        this.toast.show('Selecciona la unidad.', 'warning');
        return;
      }
      relatedUnitId = uid;
    } else if (this.isOperatorKind(kind)) {
      const oid = this.relatedOperatorId().trim();
      if (!oid) {
        this.toast.show('Selecciona el operador.', 'warning');
        return;
      }
      relatedOperatorId = oid;
    }

    const payload: Omit<Expense, 'id'> = {
      tripId,
      category: categoryText,
      amount: amountResult,
      currency: this.currency(),
      incurredAt: date,
      kind,
      description: this.description().trim() || undefined,
      vendor: this.vendor().trim() || undefined,
      paymentMethod: this.paymentMethod().trim() || undefined,
      invoiceRequired: this.invoiceRequired(),
      maintenanceTarget,
      insuranceTarget,
      relatedUnitId,
      relatedEquipmentId,
      relatedOperatorId,
      verificationScope,
    };

    this.expensesApi
      .postExpense(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row: Expense) => {
          this.toast.show('Gasto registrado.', 'success');
          this.saved.emit(row);
          this.dismiss.emit();
        },
        error: () => {
          this.toast.show('No se pudo guardar el gasto.', 'error');
        },
      });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
