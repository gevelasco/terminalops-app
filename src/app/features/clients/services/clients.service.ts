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
import { ClientsService as ClientsApiService } from '@services/api/clients';
import type { Client, CreateClientPayload } from '@shared/models/client.models';
import { createRequestGeneration } from '@shared/utils/request-generation';

/**
 * Fuente única de verdad del feature Clientes (lista en memoria + selección).
 * GET /companies/{companyId}/clients — al entrar a la tab Clientes (una vez por visita al módulo).
 * Alcance: ruta `/comercial/clients`.
 */
@Injectable()
export class ClientsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _clients = signal<readonly Client[]>([]);
  private readonly _selectedClientId = signal<string | null>(null);
  private readonly _loading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly clients = this._clients.asReadonly();
  readonly selectedClientId = this._selectedClientId.asReadonly();
  readonly selectedClient = computed(() => {
    const id = this._selectedClientId();
    if (!id) {
      return null;
    }
    return this._clients().find((c) => c.id === id) ?? null;
  });
  readonly loading = this._loading.asReadonly();

  loadClients(): void {
    if (this.disposed) {
      return;
    }
    if (this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refreshClients(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  selectClient(clientId: string): void {
    const id = clientId.trim();
    if (!id) {
      return;
    }
    this._selectedClientId.set(id);
  }

  clearSelection(): void {
    this._selectedClientId.set(null);
  }

  updateClient(client: Client): Observable<Client> {
    const keepId = this._selectedClientId() ?? client.id;
    const requestId = this.requestGen.next();
    return this.clientsApi.patchClientById(client).pipe(
      switchMap(() => this.fetchList()),
      map((list) => {
        if (!this.canApplyResponse(requestId)) {
          return this._clients().find((c) => c.id === keepId) ?? client;
        }
        this.applyList(list, keepId);
        return this._clients().find((c) => c.id === keepId) ?? client;
      }),
    );
  }

  createClient(payload: CreateClientPayload): Observable<Client> {
    const requestId = this.requestGen.next();
    return this.clientsApi.postClient(payload).pipe(
      switchMap((created) =>
        this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return created;
            }
            this.applyList(list, null);
            return this._clients().find((c) => c.id === created.id) ?? created;
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
          this.applyList(list, this._selectedClientId());
        },
        error: () => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList([], this._selectedClientId());
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private fetchList(): Observable<Client[]> {
    return this.clientsApi.getClientsList().pipe(catchError(() => of([] as Client[])));
  }

  private applyList(list: Client[], selectedId: string | null): void {
    this._clients.set(list);
    if (!selectedId) {
      return;
    }
    if (list.some((c) => c.id === selectedId)) {
      this._selectedClientId.set(selectedId);
      return;
    }
    this._selectedClientId.set(null);
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
    this._clients.set([]);
    this._selectedClientId.set(null);
    this._loading.set(false);
    this.initialLoadStarted = false;
  }
}
