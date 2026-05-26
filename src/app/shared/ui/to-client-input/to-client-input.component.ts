import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClientsService } from '@services/api/clients';
import { Client } from '@shared/models/client.models';

let clientInputSeq = 0;

@Component({
  selector: 'to-client-input',
  standalone: true,
  templateUrl: './to-client-input.component.html',
  styleUrl: './to-client-input.component.scss',
})
export class ToClientInputComponent {
  private readonly clientsApi = inject(ClientsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('');
  readonly disabled = input(false);

  /** Si es true, usa `clientsData` y no llama a la API. */
  readonly prefetchMode = input(false);
  readonly clientsData = input<Client[]>([]);

  readonly value = model('');

  /** Id de catálogo cuando el texto coincide con un cliente o el usuario elige de la lista. */
  readonly clientId = model('');

  readonly blurNotify = output<void>();

  readonly inputId = `to-client-input-${++clientInputSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly allClients = signal<Client[]>([]);
  readonly loading = signal(true);
  readonly open = signal(false);

  /** Lista filtrada por lo que escribe el usuario; vacío muestra todos. */
  readonly suggestions = computed(() => {
    const q = this.value().trim().toLowerCase();
    const all = this.allClients();
    if (!all.length) {
      return [];
    }
    if (!q) {
      return all;
    }
    return all.filter((c) => c.name.toLowerCase().includes(q));
  });

  private fetchedFromApi = false;

  constructor() {
    effect(() => {
      if (this.prefetchMode()) {
        this.allClients.set(this.clientsData());
        this.loading.set(false);
        return;
      }
      if (this.fetchedFromApi) {
        return;
      }
      this.fetchedFromApi = true;
      this.clientsApi
        .getClientsList()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (rows) => {
            this.allClients.set(rows);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
    });
  }

  onInput(ev: Event): void {
    if (this.disabled()) {
      return;
    }
    const v = (ev.target as HTMLInputElement).value;
    this.value.set(v);
    this.syncClientIdFromValue(v);
    this.open.set(true);
  }

  onFocus(): void {
    if (this.disabled()) {
      return;
    }
    if (!this.loading() && this.allClients().length > 0) {
      this.open.set(true);
    }
  }

  onControlBlur(): void {
    this.blurNotify.emit();
  }

  onPickPointerDown(c: Client, ev: Event): void {
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
      this.value.set(c.name);
      this.clientId.set(c.id);
      this.open.set(false);
      const el = this.fieldInput()?.nativeElement;
      el?.focus();
    });
  }

  @HostListener('keydown', ['$event'])
  onHostKeydown(ev: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      this.open.set(false);
    }
  }

  private syncClientIdFromValue(name: string): void {
    const t = name.trim();
    if (t === '') {
      this.clientId.set('');
      return;
    }
    const row = this.allClients().find((c) => c.name === t);
    this.clientId.set(row?.id ?? '');
  }
}
