import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  of,
  Subscription,
  type Observable,
} from 'rxjs';
import { ClientsService as ClientsApiService } from '@services/api/clients';
import type { Client, CreateClientPayload } from '@shared/models/client.models';
import { createRequestGeneration } from '@shared/utils/request-generation';

/**
 * Clientes en memoria: stubs del overview + detalle por id al abrir el drawer.
 * Alcance: ruta `/comercial/clients`.
 */
@Injectable()
export class ClientsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _clients = signal<readonly Client[]>([]);
  private readonly _selectedClientId = signal<string | null>(null);
  private readonly _detailLoading = signal(false);
  private readonly _pendingDrawerTab = signal<'details' | 'balance' | null>(null);

  private disposed = false;
  private detailSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly clients = this._clients.asReadonly();
  readonly selectedClientId = this._selectedClientId.asReadonly();
  readonly pendingDrawerTab = this._pendingDrawerTab.asReadonly();
  readonly selectedClient = computed(() => {
    const id = this._selectedClientId();
    if (!id) {
      return null;
    }
    return this._clients().find((c) => c.id === id) ?? null;
  });
  readonly detailLoading = this._detailLoading.asReadonly();

  applyOverviewRows(rows: readonly { id: string; name: string }[]): void {
    if (this.disposed) {
      return;
    }
    const previous = new Map(this._clients().map((client) => [client.id, client]));
    const next = rows.map((row) => {
      const existing = previous.get(row.id);
      if (!existing) {
        return { id: row.id, name: row.name };
      }
      if (existing.name === row.name) {
        return existing;
      }
      return { ...existing, name: row.name };
    });
    this._clients.set(next);
    const selected = this._selectedClientId();
    if (selected && !next.some((client) => client.id === selected)) {
      this._selectedClientId.set(null);
    }
  }

  selectClient(clientId: string): void {
    const id = clientId.trim();
    if (!id) {
      return;
    }
    this._selectedClientId.set(id);
    this.hydrateSelectedDetail(id);
  }

  requestDrawerTab(tab: 'details' | 'balance'): void {
    this._pendingDrawerTab.set(tab);
  }

  clearPendingDrawerTab(): void {
    this._pendingDrawerTab.set(null);
  }

  clearSelection(): void {
    this.detailSub?.unsubscribe();
    this.detailSub = null;
    this._detailLoading.set(false);
    this._selectedClientId.set(null);
    this._pendingDrawerTab.set(null);
  }

  replaceClient(updated: Client): void {
    const exists = this._clients().some((client) => client.id === updated.id);
    this._clients.update((list) =>
      exists
        ? list.map((client) => (client.id === updated.id ? updated : client))
        : [updated, ...list],
    );
    if (this._selectedClientId() === updated.id) {
      this._selectedClientId.set(updated.id);
    }
  }

  updateClient(client: Client): Observable<Client> {
    const requestId = this.requestGen.next();
    return this.clientsApi.patchClientById(client).pipe(
      map((updated) => {
        if (!this.canApplyResponse(requestId)) {
          return updated;
        }
        this.replaceClient(updated);
        return updated;
      }),
    );
  }

  createClient(payload: CreateClientPayload): Observable<Client> {
    const requestId = this.requestGen.next();
    return this.clientsApi.postClient(payload).pipe(
      map((created) => {
        if (!this.canApplyResponse(requestId)) {
          return created;
        }
        this.replaceClient(created);
        return created;
      }),
    );
  }

  deleteClient(clientId: string): Observable<void> {
    const id = clientId.trim();
    const requestId = this.requestGen.next();
    return this.clientsApi.deleteClient(id).pipe(
      map(() => {
        if (!this.canApplyResponse(requestId)) {
          return;
        }
        this._clients.update((list) => list.filter((c) => c.id !== id));
        if (this._selectedClientId() === id) {
          this.clearSelection();
        }
      }),
      map(() => void 0),
    );
  }

  refreshClientById(clientId: string): void {
    const id = clientId.trim();
    if (!id || this.disposed) {
      return;
    }
    this.clientsApi
      .getClientById(id)
      .pipe(catchError(() => of(null)))
      .subscribe((detail) => {
        if (this.disposed || !detail) {
          return;
        }
        this.replaceClient(detail);
      });
  }

  private hydrateSelectedDetail(clientId: string): void {
    const id = clientId.trim();
    if (!id || this.disposed) {
      return;
    }
    this.detailSub?.unsubscribe();
    this._detailLoading.set(true);
    this.detailSub = this.clientsApi
      .getClientById(id)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          if (this._selectedClientId() === id) {
            this._detailLoading.set(false);
          }
        }),
      )
      .subscribe((detail) => {
        if (this.disposed || this._selectedClientId() !== id) {
          return;
        }
        if (!detail) {
          return;
        }
        this.replaceClient(detail);
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.detailSub?.unsubscribe();
    this.detailSub = null;
    this._clients.set([]);
    this._selectedClientId.set(null);
    this._detailLoading.set(false);
    this._pendingDrawerTab.set(null);
  }
}
