import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@core/notifications/toast.service';
import { ExpensesService } from '@services/api/expenses';
import {
  EXPENSE_CURRENCY_OPTIONS,
  EXPENSE_PAYMENT_METHOD_OPTIONS,
  EXPENSE_VERIFICATION_SCOPE_OPTIONS,
} from '@shared/catalogs/expense-form-options';
import {
  EXPENSE_RUBRO_OPTIONS,
  applyExpenseConceptSelection,
  expenseConceptOptionsForRubro,
  isExpenseCustomConcept,
  resolveExpenseConceptFromExpense,
  validateExpenseRubroTripLink,
  type ExpenseRubro,
} from '@features/expenses/utils/expense-rubro.util';
import type {
  Expense,
  ExpenseKind,
  ExpenseVerificationScope,
} from '@shared/models/logistics.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
} from '@shared/ui/to-select/to-select.component';
import { ExpenseOperationalRelationFieldsComponent } from '@features/expenses/components/expense-operational-relation-fields/expense-operational-relation-fields.component';
import { inferExpenseRelationTab } from '@features/expenses/utils/expense-operational-relation.util';
import type { ExpenseOperationalRelationTab } from '@features/expenses/utils/expense-operational-relation.util';

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

import {
  parseExpenseAmount,
  resolveExpenseRelationFields,
  expenseIncurredDateInput,
} from '@features/expenses/utils/expenses-form.util';

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
    ExpenseOperationalRelationFieldsComponent,
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

  readonly dismiss = output<void>();
  readonly saved = output<Expense>();

  /** Si se define, el drawer opera en modo edición. */
  readonly editingExpense = input<Expense | null>(null);
  readonly isEditing = computed(() => this.editingExpense() != null);

  readonly rubroOptions = EXPENSE_RUBRO_OPTIONS;
  readonly verificationScopeOptions = EXPENSE_VERIFICATION_SCOPE_OPTIONS;
  readonly paymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS;
  readonly currencyOptions = EXPENSE_CURRENCY_OPTIONS;

  readonly rubro = model<ExpenseRubro>('gasto');
  readonly conceptId = model('gasto_custom');
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
  readonly relatedUnitId = model('');
  readonly relatedEquipmentId = model('');
  readonly relatedOperatorId = model('');
  readonly verificationScope = model<ExpenseVerificationScope>('phys_mech');
  readonly relationTab = model<ExpenseOperationalRelationTab>('trip');

  readonly conceptOptions = computed(() =>
    expenseConceptOptionsForRubro(this.rubro()),
  );

  readonly isCustomConcept = computed(() =>
    isExpenseCustomConcept(this.conceptId()),
  );

  readonly isManiobraRubro = computed(() => this.rubro() === 'maniobra');

  constructor() {
    effect(() => {
      const editing = this.editingExpense();
      if (editing) {
        this.applyExpenseToForm(editing);
      }
    });
  }

  setRubro(value: string): void {
    const rubro = value as ExpenseRubro;
    this.rubro.set(rubro);
    const first = expenseConceptOptionsForRubro(rubro)[0]?.value;
    if (first) {
      this.setConcept(first);
    }
  }

  setConcept(value: string): void {
    this.conceptId.set(value);
    const applied = applyExpenseConceptSelection(value);
    if (!applied) {
      return;
    }
    this.kind.set(applied.kind);
    if (applied.category) {
      this.category.set(applied.category);
    } else {
      this.category.set('');
    }
  }

  private applyExpenseToForm(e: Expense): void {
    const { rubro, conceptId } = resolveExpenseConceptFromExpense(e);
    this.rubro.set(rubro);
    this.conceptId.set(conceptId);
    this.kind.set(e.kind);
    this.category.set(e.category);
    this.description.set(e.description ?? '');
    this.vendor.set(e.vendor ?? '');
    this.amountStr.set(String(e.amount));
    this.currency.set(e.currency || 'MXN');
    this.paymentMethod.set(e.paymentMethod ?? '');
    this.incurredAt.set(expenseIncurredDateInput(e.incurredAt));
    this.invoiceRequired.set(e.invoiceRequired === true);
    this.tripId.set(e.tripId ?? '');
    this.relatedUnitId.set(e.relatedUnitId ?? '');
    this.relatedEquipmentId.set(e.relatedEquipmentId ?? '');
    this.relatedOperatorId.set(e.relatedOperatorId ?? '');
    if (e.verificationScope) {
      this.verificationScope.set(e.verificationScope);
    }
    this.relationTab.set(inferExpenseRelationTab(e));
  }

  submit(): void {
    const categoryText = this.category().trim();
    if (!categoryText) {
      this.toast.show('Indica el concepto del gasto.', 'warning');
      return;
    }
    const amountResult = parseExpenseAmount(this.amountStr());
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
    const tripValidation = validateExpenseRubroTripLink(this.rubro(), this.tripId());
    if (tripValidation) {
      this.toast.show(tripValidation, 'warning');
      return;
    }
    const resolved = resolveExpenseRelationFields(kind, {
      tripId: this.tripId(),
      relatedUnitId: this.relatedUnitId(),
      relatedEquipmentId: this.relatedEquipmentId(),
      relatedOperatorId: this.relatedOperatorId(),
      verificationScope: this.verificationScope(),
    });
    if (!resolved.ok) {
      this.toast.show(resolved.message, 'warning');
      return;
    }
    const {
      tripId,
      maintenanceTarget,
      insuranceTarget,
      relatedUnitId,
      relatedEquipmentId,
      relatedOperatorId,
      verificationScope,
    } = resolved.fields;

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
      relatedUnitId: relatedUnitId || undefined,
      relatedEquipmentId: relatedEquipmentId || undefined,
      relatedOperatorId: relatedOperatorId || undefined,
      verificationScope,
    };

    const editing = this.editingExpense();
    const request$ = editing
      ? this.expensesApi.patchExpense(editing.id, payload)
      : this.expensesApi.postExpense(payload);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row: Expense) => {
          this.toast.show(
            editing ? 'Gasto actualizado.' : 'Gasto registrado.',
            'success',
          );
          this.saved.emit(row);
          this.dismiss.emit();
        },
        error: () => {
          this.toast.show(
            editing ? 'No se pudo actualizar el gasto.' : 'No se pudo guardar el gasto.',
            'error',
          );
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
