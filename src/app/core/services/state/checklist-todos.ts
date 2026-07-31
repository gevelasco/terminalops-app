import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ChecklistTodo } from '@core/models/checklist-todo.models';
import {
  ChecklistApiService,
  type ChecklistTodoApi,
} from '@core/services/api/checklist';
import { SessionService } from '@core/services/state/session';

const STORAGE_PREFIX = 'terminalops.checklist.';

function storageKey(username: string): string {
  return `${STORAGE_PREFIX}${username}`;
}

function loadLocalTodos(username: string): ChecklistTodo[] {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isChecklistTodo);
  } catch {
    return [];
  }
}

function clearLocalTodos(username: string): void {
  try {
    localStorage.removeItem(storageKey(username));
  } catch {
    /* ignore */
  }
}

function isChecklistTodo(value: unknown): value is ChecklistTodo {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' &&
    typeof o['text'] === 'string' &&
    typeof o['completed'] === 'boolean' &&
    typeof o['createdAt'] === 'string'
  );
}

function toTodo(row: ChecklistTodoApi): ChecklistTodo {
  return {
    id: row.id,
    text: row.text,
    completed: row.completed,
    createdAt: row.createdAt,
  };
}

@Injectable({ providedIn: 'root' })
export class ChecklistTodosStore {
  private readonly session = inject(SessionService);
  private readonly api = inject(ChecklistApiService);
  private readonly items = signal<ChecklistTodo[]>([]);
  private loadedKey: string | null = null;
  private loadPromise: Promise<void> | null = null;

  readonly loading = signal(false);
  readonly mutating = signal(false);

  /** Más recientes primero. */
  readonly todos = computed(() =>
    [...this.items()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );

  readonly pendingCount = computed(() =>
    this.todos().filter((t) => !t.completed).length,
  );

  ensureLoaded(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const companyId = this.session.companyId();
    const userId = this.session.userId();
    if (!companyId || !userId) {
      this.loadedKey = null;
      this.items.set([]);
      return;
    }

    const key = `${companyId}:${userId}`;
    if (this.loadPromise && this.loadedKey === key) {
      return this.loadPromise;
    }
    if (this.loadedKey === key && !this.loading()) {
      return;
    }

    this.loadedKey = key;
    this.loading.set(true);
    const promise = this.fetchAndMaybeMigrate(companyId)
      .catch((err: unknown) => {
        if (this.loadedKey === key) {
          this.loadedKey = null;
          this.items.set([]);
        }
        throw err;
      })
      .finally(() => {
        if (this.loadPromise === promise) {
          this.loadPromise = null;
        }
        if (this.loadedKey === key || this.loadedKey === null) {
          this.loading.set(false);
        }
      });
    this.loadPromise = promise;
    return promise;
  }

  async add(text: string): Promise<boolean> {
    const trimmed = text.trim();
    const companyId = this.session.companyId();
    if (!trimmed || !companyId) {
      return false;
    }
    this.mutating.set(true);
    try {
      const created = await firstValueFrom(this.api.create(companyId, trimmed));
      this.items.update((list) => [toTodo(created), ...list]);
      return true;
    } finally {
      this.mutating.set(false);
    }
  }

  async toggleCompleted(id: string): Promise<void> {
    const companyId = this.session.companyId();
    const current = this.items().find((t) => t.id === id);
    if (!companyId || !current) {
      return;
    }
    const nextCompleted = !current.completed;
    this.items.update((list) =>
      list.map((item) =>
        item.id === id ? { ...item, completed: nextCompleted } : item,
      ),
    );
    try {
      await firstValueFrom(
        this.api.update(companyId, id, { completed: nextCompleted }),
      );
    } catch {
      this.items.update((list) =>
        list.map((item) =>
          item.id === id ? { ...item, completed: current.completed } : item,
        ),
      );
      throw new Error('No se pudo actualizar la tarea.');
    }
  }

  async remove(id: string): Promise<void> {
    const companyId = this.session.companyId();
    const removed = this.items().find((t) => t.id === id);
    if (!companyId || !removed) {
      return;
    }
    this.items.update((list) => list.filter((item) => item.id !== id));
    try {
      await firstValueFrom(this.api.remove(companyId, id));
    } catch {
      this.items.update((list) => [removed, ...list]);
      throw new Error('No se pudo eliminar la tarea.');
    }
  }

  /** Solo limpia cache en memoria (logout). Los datos quedan en el servidor. */
  clear(): void {
    this.loadedKey = null;
    this.loadPromise = null;
    this.loading.set(false);
    this.mutating.set(false);
    this.items.set([]);
  }

  private async fetchAndMaybeMigrate(companyId: string): Promise<void> {
    const remote = await firstValueFrom(this.api.list(companyId));
    const mapped = remote.map(toTodo);
    if (mapped.length > 0) {
      this.items.set(mapped);
      const username = this.session.username();
      if (username) {
        clearLocalTodos(username);
      }
      return;
    }

    const username = this.session.username();
    const local = username ? loadLocalTodos(username) : [];
    if (local.length === 0) {
      this.items.set([]);
      return;
    }

    const oldestFirst = [...local].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (const todo of oldestFirst) {
      const created = await firstValueFrom(this.api.create(companyId, todo.text));
      if (todo.completed) {
        await firstValueFrom(
          this.api.update(companyId, created.id, { completed: true }),
        );
      }
    }
    if (username) {
      clearLocalTodos(username);
    }
    const migrated = await firstValueFrom(this.api.list(companyId));
    this.items.set(migrated.map(toTodo));
  }
}
