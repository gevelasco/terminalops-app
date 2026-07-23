import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '@core/notifications/toast.service';
import { ExpensesService } from '@services/api/expenses';
import { SessionService } from '@services/state/session';
import {
  EXPENSE_CURRENCY_OPTIONS,
  EXPENSE_PAYMENT_METHOD_OPTIONS,
  EXPENSE_VERIFICATION_SCOPE_OPTIONS,
} from '@shared/catalogs/expense-form-options';
import {
  expensePaymentMethodLabel,
  expenseRubroLabelForExpense,
} from '@features/expenses/utils/expense-row-labels';
import {
  EXPENSE_RUBRO_OPTIONS,
  applyExpenseConceptSelection,
  expenseConceptOptionsForRubro,
  isExpenseCustomConcept,
  resolveExpenseConceptFromExpense,
  validateExpenseRubroTripLink,
  type ExpenseRubro,
} from '@features/expenses/utils/expense-rubro.util';
import {
  expenseIncurredDateInput,
  parseExpenseAmount,
  resolveExpenseRelationFields,
} from '@features/expenses/utils/expenses-form.util';
import { formatMoneyInputValue } from '@shared/utils/format-grouped-number';
import { inferExpenseRelationTab } from '@features/expenses/utils/expense-operational-relation.util';
import type {
  ExpenseOperationalRelationTab,
} from '@features/expenses/utils/expense-operational-relation.util';
import type {
  Expense,
  ExpenseKind,
  ExpenseVerificationScope,
} from '@shared/models/logistics.models';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { formatExpenseIncurredDateDisplay } from '@features/expenses/utils/expenses-form.util';
import { isAdminRole } from '@shared/utils/access-control';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';
import { isProjectedCalendarExpenseId } from '@features/expenses/utils/expenses-calendar-projection-expense.util';

export type ExpenseDetailEditSection = 'classification' | 'relation' | 'payment';

@Injectable()
export class ExpensesDetailDrawerFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly expensesApi = inject(ExpensesService);
  private readonly currencyMx = inject(CurrencyMxPipe);

  private onDismiss?: () => void;
  private onUpdated?: (expense: Expense) => void;
  private onDeleted?: () => void;
  private tripManeuverByTripId: ReadonlyMap<string, string> | undefined;

  readonly expense = signal<Expense | null>(null);
  readonly editingSection = signal<ExpenseDetailEditSection | null>(null);
  readonly saving = signal(false);
  readonly deleteConfirmOpen = signal(false);
  readonly deleteSubmitting = signal(false);

  readonly canDeleteExpense = computed(
    () => isAdminRole(this.session.role()) && !this.isProjectedExpense(),
  );
  readonly canWriteExpense = computed(
    () =>
      this.session.canWriteModule(APP_MODULE_CODES.EXPENSES) &&
      !this.isProjectedExpense(),
  );
  readonly isProjectedExpense = computed(() =>
    isProjectedCalendarExpenseId(this.expense()?.id),
  );
  readonly projectedStatusHint = computed(() => {
    if (!this.isProjectedExpense()) {
      return '';
    }
    return 'Gasto proyectado (aún no registrado en el ledger).';
  });

  readonly rubroOptions = EXPENSE_RUBRO_OPTIONS;
  readonly verificationScopeOptions = EXPENSE_VERIFICATION_SCOPE_OPTIONS;
  readonly paymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS;
  readonly currencyOptions = EXPENSE_CURRENCY_OPTIONS;

  readonly kind = signal<ExpenseKind>('other');
  readonly rubro = signal<ExpenseRubro>('gasto');
  readonly conceptId = signal('gasto_custom');
  readonly category = signal('');
  readonly description = signal('');
  readonly vendor = signal('');
  readonly amountStr = signal('');
  readonly currency = signal('MXN');
  readonly paymentMethod = signal('');
  readonly incurredAt = signal('');
  readonly invoiceRequired = signal(false);
  readonly tripId = signal('');
  readonly relatedUnitId = signal('');
  readonly relatedEquipmentId = signal('');
  readonly relatedOperatorId = signal('');
  readonly verificationScope = signal<ExpenseVerificationScope>('phys_mech');
  readonly relationTab = signal<ExpenseOperationalRelationTab>('trip');

  readonly conceptOptions = computed(() =>
    expenseConceptOptionsForRubro(this.rubro()),
  );

  readonly isCustomConcept = computed(() =>
    isExpenseCustomConcept(this.conceptId()),
  );

  readonly isManiobraRubro = computed(() => this.rubro() === 'maniobra');

  bindCallbacks(
    onUpdated: (expense: Expense) => void,
    onDismiss: () => void,
    onDeleted?: () => void,
  ): void {
    this.onUpdated = onUpdated;
    this.onDismiss = onDismiss;
    this.onDeleted = onDeleted;
  }

  setTripManeuverByTripId(
    map: ReadonlyMap<string, string> | undefined,
  ): void {
    this.tripManeuverByTripId = map;
  }

  setExpense(expense: Expense): void {
    const prevId = this.expense()?.id;
    this.expense.set(expense);
    if (prevId !== expense.id || this.editingSection() === null) {
      this.patchFormFromExpense(expense);
    }
  }

  requestDismiss(): void {
    this.onDismiss?.();
  }

  onDocKey(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') {
      return;
    }
    if (this.deleteConfirmOpen()) {
      ev.preventDefault();
      this.closeDeleteConfirm();
      return;
    }
    if (this.editingSection() !== null) {
      ev.preventDefault();
      this.cancelSectionEdit();
      return;
    }
    this.requestDismiss();
  }

  openDeleteConfirm(): void {
    if (!this.canDeleteExpense() || this.deleteSubmitting() || this.saving()) {
      return;
    }
    this.deleteConfirmOpen.set(true);
  }

  closeDeleteConfirm(): void {
    if (this.deleteSubmitting()) {
      return;
    }
    this.deleteConfirmOpen.set(false);
  }

  confirmDeleteExpense(): void {
    const e = this.expense();
    if (!e || !this.canDeleteExpense() || this.deleteSubmitting() || this.saving()) {
      return;
    }
    const label = e.category?.trim() || 'Gasto';
    this.deleteSubmitting.set(true);
    this.expensesApi
      .deleteExpense(e.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteSubmitting.set(false);
          this.deleteConfirmOpen.set(false);
          this.toast.show(`Gasto «${label}» eliminado del registro operativo.`, 'success');
          this.onDeleted?.();
          this.requestDismiss();
        },
        error: (err: unknown) => {
          this.deleteSubmitting.set(false);
          const detail = parseHttpApiErrorMessage(err)?.trim() ?? '';
          this.toast.show(
            detail || 'No se pudo eliminar el gasto. Inténtalo de nuevo.',
            'error',
          );
        },
      });
  }

  startEditSection(section: ExpenseDetailEditSection): void {
    const e = this.expense();
    if (!e) {
      return;
    }
    this.patchFormFromExpense(e);
    this.editingSection.set(section);
  }

  cancelSectionEdit(): void {
    const e = this.expense();
    if (e) {
      this.patchFormFromExpense(e);
    }
    this.editingSection.set(null);
  }

  saveClassification(): void {
    const categoryText = this.category().trim();
    if (!categoryText) {
      this.toast.show('Indica el concepto del gasto.', 'warning');
      return;
    }
    this.persistPatch({
      kind: this.kind(),
      category: categoryText,
      description: this.description().trim() || undefined,
    });
  }

  saveRelation(): void {
    const tripValidation = validateExpenseRubroTripLink(this.rubro(), this.tripId());
    if (tripValidation) {
      this.toast.show(tripValidation, 'warning');
      return;
    }
    const resolved = resolveExpenseRelationFields(this.kind(), {
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
      categoryOverride,
      descriptionHint,
      verificationScope,
      ...relationFields
    } = resolved.fields;
    this.persistPatch({
      ...relationFields,
      verificationScope,
      ...(categoryOverride ? { category: categoryOverride } : {}),
      ...(descriptionHint && !this.description().trim()
        ? { description: descriptionHint }
        : {}),
    });
  }

  savePayment(): void {
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
    this.persistPatch({
      amount: amountResult,
      currency: this.currency(),
      incurredAt: date,
      paymentMethod: this.paymentMethod().trim() || undefined,
      vendor: this.vendor().trim() || undefined,
      invoiceRequired: this.invoiceRequired(),
    });
  }

  rubroLabel(): string {
    const e = this.expense();
    return e ? expenseRubroLabelForExpense(e) : '—';
  }

  paymentLabel(): string {
    const e = this.expense();
    return e ? expensePaymentMethodLabel(e.paymentMethod) : '—';
  }

  verificationTypeLabel(): string {
    const v = this.expense()?.verificationScope;
    if (!v) {
      return '—';
    }
    return (
      EXPENSE_VERIFICATION_SCOPE_OPTIONS.find((o) => o.value === v)?.label ?? v
    );
  }

  invoiceRequiredLabel(): string {
    return this.expense()?.invoiceRequired === true ? 'Sí' : 'No';
  }

  amountFormatted(): string {
    const e = this.expense();
    return e ? this.currencyMx.transform(e.amount, e.currency) : '—';
  }

  dateFormatted(): string {
    const e = this.expense();
    return e ? formatExpenseIncurredDateDisplay(e.incurredAt, e.incurredDate) : '—';
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

  setVerificationScope(value: string): void {
    this.verificationScope.set(value as ExpenseVerificationScope);
  }

  private patchFormFromExpense(e: Expense): void {
    const { rubro, conceptId } = resolveExpenseConceptFromExpense(e);
    this.rubro.set(rubro);
    this.conceptId.set(conceptId);
    this.kind.set(e.kind);
    this.category.set(e.category);
    this.description.set(e.description ?? '');
    this.vendor.set(e.vendor ?? '');
    this.amountStr.set(formatMoneyInputValue(e.amount));
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

  private persistPatch(payload: Partial<Omit<Expense, 'id'>>): void {
    const e = this.expense();
    if (!e || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.expensesApi
      .patchExpense(e.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row) => {
          this.expense.set(row);
          this.patchFormFromExpense(row);
          this.editingSection.set(null);
          this.saving.set(false);
          this.toast.show('Gasto actualizado.', 'success');
          this.onUpdated?.(row);
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo actualizar el gasto.', 'error');
        },
      });
  }
}
