import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

const DISMISS_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _items = signal<ToastItem[]>([]);
  readonly items = this._items.asReadonly();

  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  show(message: string, variant: ToastVariant = 'info'): void {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this._items.update((list) => [...list, { id, message, variant }]);
    const t = setTimeout(() => this.dismiss(id), DISMISS_MS);
    this.timers.set(id, t);
  }

  dismiss(id: string): void {
    const t = this.timers.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      this.timers.delete(id);
    }
    this._items.update((list) => list.filter((x) => x.id !== id));
  }
}
