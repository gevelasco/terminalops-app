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
import { OperatorsService } from '@services/api/operators';
import type { OperatorLinkOption } from '@shared/models/api/api-fleet-link-options.model';
import { operatorOperationalStatusLabel } from '@shared/catalogs/operator-form-options';
import type { OperatorOperationalStatus } from '@shared/models/logistics.models';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';
import { resolveOperatorOperationalStatus } from '@shared/utils/fleet/fleet-status.resolver';
import { operatorOperationalPillClass } from '@shared/utils/operator-operational-pill';
import {
  FLEET_LINK_OPTIONS_SEARCH_DEBOUNCE_MS,
  isFleetLinkOptionsSearchAllowed,
} from '@shared/utils/fleet-link-options-search.util';

let operatorLinkSeq = 0;

@Component({
  selector: 'to-operator-link-input',
  standalone: true,
  templateUrl: './to-operator-link-input.component.html',
  styleUrl: './to-operator-link-input.component.scss',
})
export class ToOperatorLinkInputComponent {
  private readonly operatorsApi = inject(OperatorsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject(ElementRef);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('Buscar por nombre o licencia…');
  readonly disabled = input(false);
  readonly displayLabel = input('');

  readonly operatorId = model('');

  readonly blurNotify = output<void>();

  readonly inputId = `to-operator-link-input-${++operatorLinkSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly rows = signal<OperatorLinkOption[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);
  readonly searchText = signal('');

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRequestedSearch = '';

  readonly selectedRow = computed(() => {
    const id = this.operatorId().trim();
    if (!id) {
      return null;
    }
    return this.rows().find((r) => r.id === id) ?? null;
  });

  readonly suggestions = computed(() => this.rows());

  constructor() {
    installAutocompleteOutsideDismiss(
      this.hostEl,
      () => this.open(),
      () => this.open.set(false),
      this.destroyRef,
    );

    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
    });

    effect(() => {
      const id = this.operatorId().trim();
      const label = this.displayLabel().trim();
      if (!id) {
        return;
      }
      const row = this.rows().find((r) => r.id === id);
      if (row) {
        if (this.searchText() !== row.name) {
          this.searchText.set(row.name);
        }
        return;
      }
      if (label && this.searchText() !== label) {
        this.searchText.set(label);
      }
    });
  }

  nameLabel(row: OperatorLinkOption): string {
    return row.name.trim() || row.id;
  }

  resolvedOperatorStatus(row: OperatorLinkOption): OperatorOperationalStatus {
    return resolveOperatorOperationalStatus({
      status: row.status,
      isActive: row.isActive,
    });
  }

  statusPillClass(row: OperatorLinkOption): string {
    return operatorOperationalPillClass(this.resolvedOperatorStatus(row));
  }

  statusPillLabel(row: OperatorLinkOption): string {
    return operatorOperationalStatusLabel(this.resolvedOperatorStatus(row));
  }

  onInput(ev: Event): void {
    if (this.disabled()) {
      return;
    }
    const v = (ev.target as HTMLInputElement).value;
    this.searchText.set(v);
    this.open.set(true);

    const sel = this.selectedRow();
    if (sel && sel.name.trim() !== v.trim()) {
      this.operatorId.set('');
    }

    this.scheduleSearch(v);
  }

  onFocus(): void {
    if (this.disabled()) {
      return;
    }
    if (!this.loading() && this.rows().length > 0) {
      this.open.set(true);
    }
  }

  onControlBlur(): void {
    this.blurNotify.emit();
  }

  onPickPointerDown(row: OperatorLinkOption, ev: Event): void {
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
      this.operatorId.set(row.id);
      this.searchText.set(row.name);
      this.open.set(false);
      this.fieldInput()?.nativeElement.focus();
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

  private scheduleSearch(raw: string): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(
      () => this.fetchLinkOptions(raw),
      FLEET_LINK_OPTIONS_SEARCH_DEBOUNCE_MS,
    );
  }

  private fetchLinkOptions(raw: string): void {
    const search = raw.trim();
    if (!isFleetLinkOptionsSearchAllowed(search)) {
      this.rows.set([]);
      this.loading.set(false);
      return;
    }

    if (search === this.lastRequestedSearch && this.rows().length > 0) {
      return;
    }
    this.lastRequestedSearch = search;
    this.loading.set(true);

    this.operatorsApi
      .getOperatorLinkOptions({ search, limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items }) => {
          this.rows.set(items);
          this.loading.set(false);
          if (items.length > 0) {
            this.open.set(true);
          }
        },
        error: () => this.loading.set(false),
      });
  }
}
