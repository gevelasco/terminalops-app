import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  of,
  Subscription,
  switchMap,
  type Observable,
} from 'rxjs';
import { OperatorsService as OperatorsApiService } from '@services/api/operators';
import type { Operator } from '@shared/models/logistics.models';
import {
  operatorListPaymentFieldsFromSummary,
  type OperatorOperationSummary,
} from '@features/operators/utils/operator-operation-summary';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { sortOperatorsByOperationalStatus } from '@shared/utils/operator-operational-status-sort';

/**
 * Fuente única de verdad del feature Operadores (lista en memoria + selección).
 * GET /companies/{companyId}/operators — una vez al entrar; refresh solo tras mutaciones explícitas.
 * Alcance: ruta `/operators`.
 */
@Injectable()
export class OperatorsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly operatorsApi = inject(OperatorsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _operators = signal<readonly Operator[]>([]);
  private readonly _selectedOperatorId = signal<string | null>(null);
  private readonly _loading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly operators = this._operators.asReadonly();
  readonly selectedOperatorId = this._selectedOperatorId.asReadonly();
  readonly selectedOperator = computed(() => {
    const id = this._selectedOperatorId();
    if (!id) {
      return null;
    }
    return this._operators().find((o) => o.id === id) ?? null;
  });
  readonly loading = this._loading.asReadonly();

  loadOperators(): void {
    if (this.disposed) {
      return;
    }
    if (this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refreshOperators(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  selectOperator(operatorId: string): void {
    const id = operatorId.trim();
    if (!id) {
      return;
    }
    this._selectedOperatorId.set(id);
  }

  clearSelection(): void {
    this._selectedOperatorId.set(null);
  }

  applyOperatorPaymentSummary(
    operatorId: string,
    summary: Pick<
      OperatorOperationSummary,
      'owedAmount' | 'nextPayDueYmd' | 'nextPayDueBadgeVariant'
    >,
  ): void {
    const paymentFields = operatorListPaymentFieldsFromSummary(summary);
    this._operators.update((list) =>
      list.map((operator) =>
        operator.id === operatorId ? { ...operator, ...paymentFields } : operator,
      ),
    );
  }

  replaceOperator(updated: Operator): void {
    this._operators.update((list) =>
      sortOperatorsByOperationalStatus(
        list.map((operator) => (operator.id === updated.id ? updated : operator)),
      ),
    );
    if (this._selectedOperatorId() === updated.id) {
      this._selectedOperatorId.set(updated.id);
    }
  }

  updateOperator(operator: Operator): Observable<Operator> {
    const keepId = this._selectedOperatorId() ?? operator.id;
    const requestId = this.requestGen.next();
    return this.operatorsApi.patchOperatorById(operator).pipe(
      switchMap(() => this.fetchList()),
      map((list) => {
        if (!this.canApplyResponse(requestId)) {
          return this._operators().find((o) => o.id === keepId) ?? operator;
        }
        this.applyList(list, keepId);
        return this._operators().find((o) => o.id === keepId) ?? operator;
      }),
    );
  }

  createOperator(payload: Omit<Operator, 'id'>): Observable<Operator> {
    const requestId = this.requestGen.next();
    return this.operatorsApi.postOperator(payload).pipe(
      switchMap((created) =>
        this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return created;
            }
            this.applyList(list, null);
            return this._operators().find((o) => o.id === created.id) ?? created;
          }),
        ),
      ),
    );
  }

  private runFetch(): void {
    if (this.disposed) {
      return;
    }
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.fetchList()
      .pipe(
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (list) => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList(list, this._selectedOperatorId());
        },
        error: () => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList([], this._selectedOperatorId());
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private fetchList(): Observable<Operator[]> {
    return this.operatorsApi
      .getOperatorsList()
      .pipe(catchError(() => of([] as Operator[])));
  }

  private applyList(list: Operator[], selectedId: string | null): void {
    this._operators.set(sortOperatorsByOperationalStatus(list));
    if (!selectedId) {
      return;
    }
    if (list.some((o) => o.id === selectedId)) {
      this._selectedOperatorId.set(selectedId);
      return;
    }
    this._selectedOperatorId.set(null);
  }

  /** Destrucción terminal al salir del feature (no reutilizar instancia). */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._operators.set([]);
    this._selectedOperatorId.set(null);
    this._loading.set(false);
    this.initialLoadStarted = false;
  }
}
