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
import { Observable } from 'rxjs';
import { UnitsService } from '@services/api/units';
import { EquipmentService } from '@services/api/equipment';
import type { FleetResourceLinkOption } from '@shared/models/api/api-fleet-link-options.model';
import {
  fleetOperationalKeyLabel,
  fleetOperationalPillClass,
} from '@features/fleet/utils/fleet-unit-table-row';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';
import { resolveUnitOperationalKey } from '@shared/utils/fleet/fleet-status.resolver';
import {
  FLEET_LINK_OPTIONS_SEARCH_DEBOUNCE_MS,
  isFleetLinkOptionsSearchAllowed,
} from '@shared/utils/fleet-link-options-search.util';

export type FleetResourceLinkKind = 'unit' | 'equipment';

let fleetResourceLinkSeq = 0;

@Component({
  selector: 'to-fleet-resource-link-input',
  standalone: true,
  templateUrl: './to-fleet-resource-link-input.component.html',
  styleUrl: './to-fleet-resource-link-input.component.scss',
})
export class ToFleetResourceLinkInputComponent {
  private readonly unitsApi = inject(UnitsService);
  private readonly equipmentApi = inject(EquipmentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject(ElementRef);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly resource = input.required<FleetResourceLinkKind>();
  readonly label = input<string>('');
  readonly placeholder = input<string>('Buscar por código o placa…');
  readonly disabled = input(false);
  /** Etiqueta inicial al editar (sin precargar catálogo). */
  readonly displayLabel = input('');

  readonly resourceId = model('');

  readonly blurNotify = output<void>();

  readonly inputId = `to-fleet-resource-link-input-${++fleetResourceLinkSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly rows = signal<FleetResourceLinkOption[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);
  readonly searchText = signal('');

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRequestedKey = '';

  readonly selectedRow = computed(() => {
    const id = this.resourceId().trim();
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
      const id = this.resourceId().trim();
      const label = this.displayLabel().trim();
      if (!id) {
        return;
      }
      const row = this.rows().find((r) => r.id === id);
      if (row) {
        const fieldLabel = this.fieldLabelFor(row);
        if (this.searchText() !== fieldLabel) {
          this.searchText.set(fieldLabel);
        }
        return;
      }
      if (label && this.searchText() !== label) {
        this.searchText.set(label);
      }
    });
  }

  codeLabel(row: FleetResourceLinkOption): string {
    return row.operationalCode.trim() || row.id;
  }

  statusPillClass(row: FleetResourceLinkOption): string {
    const key = resolveUnitOperationalKey({
      persistedStatus: row.status,
      isActive: row.isActive,
    });
    return fleetOperationalPillClass(key);
  }

  statusPillLabel(row: FleetResourceLinkOption): string {
    const key = resolveUnitOperationalKey({
      persistedStatus: row.status,
      isActive: row.isActive,
    });
    return fleetOperationalKeyLabel(key);
  }

  onInput(ev: Event): void {
    if (this.disabled()) {
      return;
    }
    const v = (ev.target as HTMLInputElement).value;
    this.searchText.set(v);
    this.open.set(true);

    const sel = this.selectedRow();
    if (sel && this.fieldLabelFor(sel).trim() !== v.trim()) {
      this.resourceId.set('');
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

  onPickPointerDown(row: FleetResourceLinkOption, ev: Event): void {
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
      this.resourceId.set(row.id);
      this.searchText.set(this.fieldLabelFor(row));
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

  private fieldLabelFor(row: FleetResourceLinkOption): string {
    return this.codeLabel(row);
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

    const requestKey = `${this.resource()}:${search}`;
    if (requestKey === this.lastRequestedKey && this.rows().length > 0) {
      return;
    }
    this.lastRequestedKey = requestKey;
    this.loading.set(true);

    this.linkOptionsRequest(search)
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

  private linkOptionsRequest(
    search: string,
  ): Observable<{ items: FleetResourceLinkOption[] }> {
    const params = { search, limit: 50 };
    return this.resource() === 'unit'
      ? this.unitsApi.getUnitLinkOptions(params)
      : this.equipmentApi.getEquipmentLinkOptions(params);
  }
}
