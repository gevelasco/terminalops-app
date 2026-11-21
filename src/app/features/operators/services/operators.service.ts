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
 *
 * La lista omite `photoDataUrl`; al seleccionar se hidrata el detalle (foto incluida).
 */
@Injectable()
export class OperatorsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly operatorsApi = inject(OperatorsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _operators = signal<readonly Operator[]>([]);
  private readonly _selectedOperatorId = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _hydrated = signal(false);
  private readonly _detailLoading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;
  private detailSub: Subscription | null = null;

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
  readonly hydrated = this._hydrated.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();

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
    this.hydrateSelectedDetail(id);
  }

  clearSelection(): void {
    this.detailSub?.unsubscribe();
    this.detailSub = null;
    this._detailLoading.set(false);
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

  deleteOperator(operatorId: string): Observable<void> {
    const requestId = this.requestGen.next();
    return this.operatorsApi.deleteOperator(operatorId).pipe(
      switchMap(() => this.fetchList()),
      map((list) => {
        if (this.canApplyResponse(requestId)) {
          this.applyList(list, null);
        }
      }),
      map(() => void 0),
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
            this._hydrated.set(true);
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
      this.hydrateSelectedDetail(selectedId);
      return;
    }
    this.clearSelection();
  }

  /**
   * Lista no trae `photoDataUrl`; el drawer necesita el GET por id.
   * Conserva métricas de lista (owedAmount, etc.) si el detalle no las incluye.
   */
  private hydrateSelectedDetail(operatorId: string): void {
    const id = operatorId.trim();
    if (!id || this.disposed) {
      return;
    }
    const listRow = this._operators().find((o) => o.id === id);
    if (listRow?.photoDataUrl?.trim()) {
      return;
    }

    this.detailSub?.unsubscribe();
    this._detailLoading.set(true);
    this.detailSub = this.operatorsApi
      .getOperatorById(id)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          if (this._selectedOperatorId() === id) {
            this._detailLoading.set(false);
          }
        }),
      )
      .subscribe((detail) => {
        if (this.disposed || !detail || this._selectedOperatorId() !== id) {
          return;
        }
        const current = this._operators().find((o) => o.id === id);
        this.replaceOperator({
          ...detail,
          maneuverCount: detail.maneuverCount ?? current?.maneuverCount,
          lastManeuver: detail.lastManeuver ?? current?.lastManeuver,
          nextPayDueOn: detail.nextPayDueOn ?? current?.nextPayDueOn,
          nextPayDueVariant:
            detail.nextPayDueVariant ?? current?.nextPayDueVariant,
          owedAmount: detail.owedAmount ?? current?.owedAmount,
          hasPhoto:
            detail.hasPhoto === true ||
            Boolean(detail.photoDataUrl?.trim()) ||
            current?.hasPhoto,
        });
      });
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
    this.detailSub?.unsubscribe();
    this.detailSub = null;
    this._operators.set([]);
    this._selectedOperatorId.set(null);
    this._loading.set(false);
    this._detailLoading.set(false);
    this._hydrated.set(false);
    this.initialLoadStarted = false;
  }
}
