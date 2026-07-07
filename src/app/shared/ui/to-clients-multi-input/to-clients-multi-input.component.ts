import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ClientsService,
  type ClientPickerOption,
} from '@services/api/clients';

let clientsMultiSeq = 0;

@Component({
  selector: 'to-clients-multi-input',
  standalone: true,
  templateUrl: './to-clients-multi-input.component.html',
  styleUrl: './to-clients-multi-input.component.scss',
})
export class ToClientsMultiInputComponent {
  private readonly clientsApi = inject(ClientsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');
  private readonly chipsRow = viewChild<ElementRef<HTMLElement>>('chipsRow');

  private resizeObserver: ResizeObserver | null = null;
  private loadRequested = false;

  readonly placeholder = input('Buscar cliente…');
  readonly disabled = input(false);

  readonly clientIds = model<string[]>([]);
  readonly query = model('');

  readonly inputId = `to-clients-multi-${++clientsMultiSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly allClients = signal<ClientPickerOption[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);
  readonly visibleChipCount = signal(0);

  readonly selectedClients = computed(() => {
    const ids = new Set(this.clientIds());
    return this.allClients().filter((c) => ids.has(c.id));
  });

  readonly visibleChips = computed(() => {
    const all = this.selectedClients();
    const n = this.visibleChipCount();
    if (n <= 0) {
      return [];
    }
    return all.slice(0, Math.min(n, all.length));
  });

  readonly overflowCount = computed(() => {
    const total = this.selectedClients().length;
    const shown = this.visibleChips().length;
    return Math.max(0, total - shown);
  });

  readonly listClients = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.allClients();
    const filtered = q
      ? list.filter((c) => c.name.toLowerCase().includes(q))
      : list;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  constructor() {
    afterNextRender(() => {
      const row = this.chipsRow()?.nativeElement;
      if (!row || typeof ResizeObserver === 'undefined') {
        return;
      }
      this.resizeObserver = new ResizeObserver(() => this.layoutVisibleChips());
      this.resizeObserver.observe(row);
      this.layoutVisibleChips();
    });

    this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());

    effect(() => {
      this.selectedClients();
      queueMicrotask(() => this.layoutVisibleChips());
    });
  }

  isSelected(id: string): boolean {
    return this.clientIds().includes(id);
  }

  onInput(ev: Event): void {
    if (this.disabled()) {
      return;
    }
    this.ensureClientsLoaded();
    this.query.set((ev.target as HTMLInputElement).value);
    this.open.set(true);
  }

  onFocus(): void {
    if (this.disabled()) {
      return;
    }
    this.ensureClientsLoaded();
    this.open.set(true);
  }

  onFieldClick(ev: Event): void {
    if (this.disabled()) {
      return;
    }
    const target = ev.target as HTMLElement;
    if (target.closest('.to-clients-multi__chip-remove')) {
      return;
    }
    this.ensureClientsLoaded();
    this.open.set(true);
    if (target.tagName !== 'INPUT') {
      queueMicrotask(() => this.fieldInput()?.nativeElement.focus());
    }
  }

  toggleOpen(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    if (this.disabled()) {
      return;
    }
    if (this.open()) {
      this.close();
    } else {
      this.ensureClientsLoaded();
      this.open.set(true);
      queueMicrotask(() => this.fieldInput()?.nativeElement.focus());
    }
  }

  onTogglePointerDown(c: ClientPickerOption, ev: Event): void {
    if (this.disabled()) {
      return;
    }
    const pe = ev as PointerEvent;
    if (typeof pe.button === 'number' && pe.button !== 0) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    queueMicrotask(() => {
      this.toggleClient(c.id);
      this.open.set(true);
      this.fieldInput()?.nativeElement.focus();
      this.layoutVisibleChips();
    });
  }

  removeClient(id: string, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.clientIds.update((ids) => ids.filter((x) => x !== id));
    queueMicrotask(() => this.layoutVisibleChips());
  }

  clearAll(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.clientIds.set([]);
    this.query.set('');
    this.layoutVisibleChips();
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(ev: PointerEvent): void {
    if (!this.open()) {
      return;
    }
    const host = this.hostEl.nativeElement;
    if (!host.contains(ev.target as Node)) {
      this.close();
    }
  }

  @HostListener('keydown', ['$event'])
  onHostKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape' && this.open()) {
      ev.stopPropagation();
      this.close();
    }
  }

  private ensureClientsLoaded(): void {
    if (this.loadRequested || this.allClients().length > 0) {
      return;
    }
    this.loadRequested = true;
    this.loading.set(true);
    this.clientsApi
      .getClientPickerOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.allClients.set(rows);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private toggleClient(id: string): void {
    this.clientIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  private close(): void {
    this.open.set(false);
    this.query.set('');
  }

  private layoutVisibleChips(): void {
    const row = this.chipsRow()?.nativeElement;
    const selected = this.selectedClients();
    const total = selected.length;

    if (!row || total === 0) {
      this.visibleChipCount.set(0);
      return;
    }

    const gap = 4;
    const inputMin = 44;
    const moreChipWidth = 34;
    const available = Math.max(0, row.clientWidth - inputMin);

    let used = 0;
    let fit = 0;

    for (let i = 0; i < total; i++) {
      const chipW = this.estimateChipWidth(selected[i].name);
      const remaining = total - (i + 1);
      const reserve = remaining > 0 ? moreChipWidth + gap : 0;
      const nextUsed = (fit > 0 ? gap : 0) + chipW;

      if (fit > 0 && used + nextUsed + reserve > available) {
        break;
      }
      if (fit === 0 && chipW + reserve > available && total > 1) {
        fit = 1;
        break;
      }

      used += nextUsed;
      fit++;
    }

    if (fit === 0 && total > 0) {
      fit = 1;
    }

    this.visibleChipCount.set(Math.min(fit, total));
  }

  private estimateChipWidth(name: string): number {
    return Math.min(128, 28 + name.length * 6.2);
  }
}
