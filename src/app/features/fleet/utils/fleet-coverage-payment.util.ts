import type { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, type Observable, type Subscription } from 'rxjs';
import type { ExpensesService } from '@core/services/api/expenses';
import type { ToastService } from '@core/notifications/toast.service';
import type { Expense } from '@shared/models/logistics.models';
import {
  buildFleetCoverageExpensesPageParams,
  type FleetCoverageExpenseKind,
  type FleetCoverageExpenseScope,
} from '@features/fleet/utils/fleet-coverage-expenses.util';

/** Campos mínimos de una fila de calendario (seguro / GPS / tenencia). */
export type FleetCoverageScheduleRow = {
  dueDate: string;
  canConfirm: boolean;
  expenseId?: string;
};

export function fleetPaymentDueYmdFromDate(next: Date): string {
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Hoy en UTC `YYYY-MM-DD` (misma base que los drawers de flota actuales). */
export function fleetCoveragePaidAtTodayYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Prioriza la fila `canConfirm` del calendario; si no hay, usa la próxima fecha calculada.
 */
export function resolveFleetCoverageConfirmDueDate(
  schedule: readonly FleetCoverageScheduleRow[],
  nextDate: Date | null | undefined,
): string | null {
  const scheduleRow = schedule.find((row) => row.canConfirm);
  if (scheduleRow) {
    return scheduleRow.dueDate;
  }
  if (!nextDate) {
    return null;
  }
  return fleetPaymentDueYmdFromDate(nextDate);
}

export type FleetCoverageConfirmLookup =
  | { ok: true; expenseId: string }
  | { ok: false; reason: 'empty' | 'blocked' | 'missing_expense' };

export function lookupFleetCoverageConfirmExpense(
  schedule: readonly FleetCoverageScheduleRow[],
  dueDate: string,
): FleetCoverageConfirmLookup {
  const normalizedDueDate = dueDate.trim();
  if (!normalizedDueDate) {
    return { ok: false, reason: 'empty' };
  }
  const scheduleRow = schedule.find((row) => row.dueDate === normalizedDueDate);
  if (scheduleRow && !scheduleRow.canConfirm) {
    return { ok: false, reason: 'blocked' };
  }
  const expenseId = scheduleRow?.expenseId?.trim();
  if (!expenseId) {
    return { ok: false, reason: 'missing_expense' };
  }
  return { ok: true, expenseId };
}

export type ConfirmFleetCoveragePaymentParams = {
  expensesApi: ExpensesService;
  toast: ToastService;
  destroyRef: DestroyRef;
  schedule: readonly FleetCoverageScheduleRow[];
  dueDate: string;
  successMessage: string;
  missingExpenseMessage: string;
  setSaving: (saving: boolean) => void;
  onSuccess: () => void;
};

/**
 * Marca el gasto del ciclo como pagado (`paidAt`).
 * Devuelve `false` si no se inició el request (validación / estado).
 */
export function confirmFleetCoverageSchedulePayment(
  params: ConfirmFleetCoveragePaymentParams,
): boolean {
  const lookup = lookupFleetCoverageConfirmExpense(params.schedule, params.dueDate);
  if (lookup.ok === false) {
    if (lookup.reason === 'missing_expense') {
      params.toast.show(params.missingExpenseMessage, 'warning');
    }
    return false;
  }

  params.setSaving(true);
  const paidAt = fleetCoveragePaidAtTodayYmd();
  params.expensesApi
    .patchExpense(lookup.expenseId, { paidAt })
    .pipe(takeUntilDestroyed(params.destroyRef))
    .subscribe({
      next: () => {
        params.setSaving(false);
        params.toast.show(params.successMessage, 'success');
        params.onSuccess();
      },
      error: () => {
        params.setSaving(false);
        params.toast.show('No se pudo registrar el pago.', 'error');
      },
    });
  return true;
}

export type LoadFleetCoverageExpensesParams = {
  expensesApi: ExpensesService;
  scope: FleetCoverageExpenseScope;
  kind: FleetCoverageExpenseKind;
  bounds: { from: string; to: string } | null;
  requestId: number;
  isCurrentRequest: (requestId: number) => boolean;
  setItems: (items: Expense[]) => void;
};

/** Carga paginada de gastos de cobertura; ignora respuestas stale por `requestId`. */
export function subscribeFleetCoverageExpensesPage(
  params: LoadFleetCoverageExpensesParams,
): Subscription | null {
  if (!params.bounds) {
    params.setItems([]);
    return null;
  }
  return params.expensesApi
    .getExpensesPage(
      buildFleetCoverageExpensesPageParams(params.scope, params.kind, params.bounds),
    )
    .pipe(
      catchError(() =>
        of({ items: [] as Expense[], total: 0, page: 1, limit: 0, totalAmount: 0 }),
      ),
    )
    .subscribe((res) => {
      if (!params.isCurrentRequest(params.requestId)) {
        return;
      }
      params.setItems(res.items);
    });
}

/** Observable tipado para patch de `paidAt` (tests / callers avanzados). */
export function patchFleetCoverageExpensePaidAt(
  expensesApi: ExpensesService,
  expenseId: string,
  paidAt = fleetCoveragePaidAtTodayYmd(),
): Observable<Expense> {
  return expensesApi.patchExpense(expenseId, { paidAt });
}
