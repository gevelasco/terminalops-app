import { computed, inject, Injectable, signal } from '@angular/core';
import type { ChecklistTodo } from '@core/models/checklist-todo.models';
import { SessionService } from '@core/services/state/session';

const STORAGE_PREFIX = 'terminalops.checklist.';

function storageKey(username: string): string {
  return `${STORAGE_PREFIX}${username}`;
}

function loadTodos(username: string): ChecklistTodo[] {
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

@Injectable({ providedIn: 'root' })
export class ChecklistTodosStore {
  private readonly session = inject(SessionService);
  private readonly items = signal<ChecklistTodo[]>([]);
  private loadedForUser: string | null = null;

  /** Más recientes primero. */
  readonly todos = computed(() =>
    [...this.items()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );

  readonly pendingCount = computed(() => this.todos().filter((t) => !t.completed).length);

  ensureLoaded(): void {
    const user = this.session.username() ?? 'default';
    if (this.loadedForUser === user) {
      return;
    }
    this.loadedForUser = user;
    this.items.set(loadTodos(user));
  }

  add(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }
    const next: ChecklistTodo = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.items.update((list) => [next, ...list]);
    this.persist();
    return true;
  }

  toggleCompleted(id: string): void {
    this.items.update((list) =>
      list.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
    this.persist();
  }

  remove(id: string): void {
    this.items.update((list) => list.filter((item) => item.id !== id));
    this.persist();
  }

  clear(): void {
    this.loadedForUser = null;
    this.items.set([]);
  }

  private persist(): void {
    const user = this.loadedForUser ?? this.session.username() ?? 'default';
    try {
      localStorage.setItem(storageKey(user), JSON.stringify(this.items()));
    } catch {
      /* ignore quota / private mode */
    }
  }
}
