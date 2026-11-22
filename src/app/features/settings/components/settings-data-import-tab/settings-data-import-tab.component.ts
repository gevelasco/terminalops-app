import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, map, of, switchMap } from 'rxjs';
import { GeoApiService } from '@core/services/api/geo';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { DataImportCatalogService } from '@features/settings/services/data-import-catalog.service';
import { SettingsDataImportService } from '@features/settings/services/settings-data-import.service';
import { applyDataImportUniquenessRules } from '@features/settings/utils/data-import/data-import-uniqueness.util';
import {
  DATA_IMPORT_KIND_ORDER,
  type DataImportEntityKind,
  type DataImportPreparedRow,
  type DataImportSheetPreview,
} from '@features/settings/utils/data-import/data-import.types';
import { DATA_IMPORT_SHEET_META } from '@features/settings/utils/data-import/data-import-sheet-meta';
import { DATA_IMPORT_CLIENT_EXAMPLE_COLUMNS } from '@features/settings/utils/data-import/data-import-client-example-preview';
import {
  DATA_IMPORT_OPERATOR_EXAMPLE_COLUMNS,
  DATA_IMPORT_OPERATOR_EXAMPLE_ROWS,
} from '@features/settings/utils/data-import/data-import-operator-example-preview';
import { DATA_IMPORT_EQUIPMENT_EXAMPLE_COLUMNS } from '@features/settings/utils/data-import/data-import-equipment-example-preview';
import { DATA_IMPORT_UNIT_EXAMPLE_COLUMNS } from '@features/settings/utils/data-import/data-import-unit-example-preview';
import { enrichClientImportRowsWithGeo } from '@features/settings/utils/data-import/data-import-client-enrich.util';
import {
  downloadDataImportTemplateForKind,
  parseDataImportWorkbookForKind,
} from '@features/settings/utils/data-import/data-import-workbook.util';
import type { KpiTitleIcon } from '@shared/models/logistics.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToCardComponent } from '@shared/ui/to-card/to-card.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';

const KIND_LABEL: Record<DataImportEntityKind, string> = {
  clients: 'Clientes',
  operators: 'Operadores',
  units: 'Unidades',
  equipment: 'Equipos',
};

const KIND_ICON: Record<DataImportEntityKind, KpiTitleIcon> = {
  clients: 'clients',
  operators: 'operators',
  units: 'units',
  equipment: 'equipment',
};

const KIND_BLURB: Record<DataImportEntityKind, string> = {
  clients:
    'Una fila = un cliente. Solo «Nombre o razón social» es obligatorio; el resto del expediente (fiscal, entrega, contacto, crédito) es opcional en la plantilla.',
  operators:
    'Una fila = un operador. Solo «Número de licencia» es obligatorio; el resto del expediente es opcional. Validamos que la licencia no se repita.',
  units:
    'Una fila = una unidad. Obligatorios: placa, marca, versión y año. El resto opcional. Placa, serie y motor no deben repetirse.',
  equipment:
    'Una fila = un equipo (remolque/semirremolque). Obligatorios: placa, marca, tipo de equipo y año. Placa y serie no deben repetirse. El enganche a unidad no se importa.',
};

export type DataImportFailureRow = {
  rowNumber: number;
  summary: string;
  reason: string;
};

const DATA_IMPORT_LAST_AT_STORAGE = 'to-data-import-last-at';

type ModuleSlot = {
  fileName: string | null;
  preview: DataImportSheetPreview | null;
  importing: boolean;
  progress: string | null;
  processing: boolean;
  processingMessage: string | null;
  lastImportCreated: number;
  lastImportFailures: DataImportFailureRow[];
  /** Momento en que filas de este módulo se guardaron en la base (importación exitosa). */
  lastImportedAt: number | null;
};

function emptySlot(preserve?: Pick<ModuleSlot, 'lastImportedAt'>): ModuleSlot {
  return {
    fileName: null,
    preview: null,
    importing: false,
    progress: null,
    processing: false,
    processingMessage: null,
    lastImportCreated: 0,
    lastImportFailures: [],
    lastImportedAt: preserve?.lastImportedAt ?? null,
  };
}

function readStoredLastImportedAt(
  companyId: string | null,
  kind: DataImportEntityKind,
): number | null {
  if (!companyId) {
    return null;
  }
  try {
    const raw = localStorage.getItem(`${DATA_IMPORT_LAST_AT_STORAGE}:${companyId}:${kind}`);
    if (!raw) {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function storeLastImportedAt(
  companyId: string | null,
  kind: DataImportEntityKind,
  at: number,
): void {
  if (!companyId) {
    return;
  }
  try {
    localStorage.setItem(`${DATA_IMPORT_LAST_AT_STORAGE}:${companyId}:${kind}`, String(at));
  } catch {
    /* quota / private mode */
  }
}

function parseImportFailureMessage(msg: string): DataImportFailureRow | null {
  const m = msg.match(/fila (\d+) \((.+)\): (.+)$/);
  if (!m) {
    return null;
  }
  return {
    rowNumber: Number(m[1]),
    summary: m[2] ?? '',
    reason: m[3] ?? msg,
  };
}

function initialSlots(companyId: string | null): Record<DataImportEntityKind, ModuleSlot> {
  const withStored = (kind: DataImportEntityKind): ModuleSlot =>
    emptySlot({ lastImportedAt: readStoredLastImportedAt(companyId, kind) });
  return {
    clients: withStored('clients'),
    operators: withStored('operators'),
    units: withStored('units'),
    equipment: withStored('equipment'),
  };
}

@Component({
  selector: 'app-settings-data-import-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'settings-data-import-tab-host',
  },
  imports: [ToButtonComponent, ToIconComponent, ToCardComponent],
  templateUrl: './settings-data-import-tab.component.html',
  styleUrl: './settings-data-import-tab.component.scss',
})
export class SettingsDataImportTabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly importRunner = inject(SettingsDataImportService);
  private readonly catalogLoader = inject(DataImportCatalogService);
  private readonly geo = inject(GeoApiService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  readonly sheetMeta = DATA_IMPORT_SHEET_META;
  readonly kindOrder = DATA_IMPORT_KIND_ORDER;
  readonly kindLabel = KIND_LABEL;
  readonly kindIcon = KIND_ICON;
  readonly kindBlurb = KIND_BLURB;
  readonly clientExampleColumns = DATA_IMPORT_CLIENT_EXAMPLE_COLUMNS;
  readonly operatorExampleColumns = DATA_IMPORT_OPERATOR_EXAMPLE_COLUMNS;
  readonly operatorExampleRows = DATA_IMPORT_OPERATOR_EXAMPLE_ROWS;
  readonly unitExampleColumns = DATA_IMPORT_UNIT_EXAMPLE_COLUMNS;
  readonly equipmentExampleColumns = DATA_IMPORT_EQUIPMENT_EXAMPLE_COLUMNS;

  readonly slots = signal<Record<DataImportEntityKind, ModuleSlot>>(
    initialSlots(this.session.companyId()),
  );
  readonly catalogLoadingKind = signal<DataImportEntityKind | null>(null);
  readonly selectedKind = signal<DataImportEntityKind>('clients');

  readonly anyImporting = computed(() =>
    DATA_IMPORT_KIND_ORDER.some((k) => this.slots()[k].importing),
  );

  moduleStep(kind: DataImportEntityKind): number {
    return DATA_IMPORT_KIND_ORDER.indexOf(kind) + 1;
  }

  slot(kind: DataImportEntityKind): ModuleSlot {
    return this.slots()[kind];
  }

  readyCount(kind: DataImportEntityKind): number {
    return (this.slot(kind).preview?.rows ?? []).filter((r) => r.status === 'ready').length;
  }

  errorCount(kind: DataImportEntityKind): number {
    return (this.slot(kind).preview?.rows ?? []).filter((r) => r.status === 'error').length;
  }

  canImportKind(kind: DataImportEntityKind): boolean {
    const s = this.slot(kind);
    return (
      !this.anyImporting() &&
      !s.processing &&
      !s.importing &&
      this.readyCount(kind) > 0
    );
  }

  selectKind(kind: DataImportEntityKind): void {
    this.selectedKind.set(kind);
  }

  /** Bloquea acciones del panel derecho si otro módulo está ocupado. */
  detailActionsDisabled(kind: DataImportEntityKind): boolean {
    return DATA_IMPORT_KIND_ORDER.some(
      (k) =>
        k !== kind &&
        (this.slots()[k].processing ||
          this.slots()[k].importing ||
          this.catalogLoadingKind() === k),
    );
  }

  moduleStatusLine(kind: DataImportEntityKind): string {
    const s = this.slot(kind);
    if (s.importing) {
      return 'Importando…';
    }
    if (s.processing || this.catalogLoadingKind() === kind) {
      return 'Validando archivo…';
    }
    if (s.fileName && s.preview) {
      const ready = this.readyCount(kind);
      const err = this.errorCount(kind);
      if (ready === 0 && err > 0) {
        return `${err} con error en vista previa`;
      }
      if (err > 0) {
        return `Vista previa: ${ready} listos · ${err} error`;
      }
      return `Vista previa: ${ready} listo(s)`;
    }
    return this.lastImportStatusLine(kind);
  }

  lastImportStatusLine(kind: DataImportEntityKind): string {
    const at = this.slot(kind).lastImportedAt;
    if (!at) {
      return 'Sin importación previa';
    }
    return `Última carga: ${this.formatImportInstant(at)}`;
  }

  lastImportDetailLine(kind: DataImportEntityKind): string {
    const at = this.slot(kind).lastImportedAt;
    if (!at) {
      return `Aún no has importado ${KIND_LABEL[kind].toLowerCase()} desde esta pantalla.`;
    }
    return `Última importación a la base: ${this.formatImportInstant(at)}.`;
  }

  private formatImportInstant(at: number): string {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(at));
  }

  private markModuleImported(kind: DataImportEntityKind): number {
    const at = Date.now();
    storeLastImportedAt(this.session.companyId(), kind, at);
    return at;
  }

  isProcessing(kind: DataImportEntityKind): boolean {
    return this.slot(kind).processing || this.catalogLoadingKind() === kind;
  }

  downloadTemplate(kind: DataImportEntityKind): void {
    downloadDataImportTemplateForKind(kind);
  }

  clearFile(kind: DataImportEntityKind, ev?: Event): void {
    ev?.stopPropagation();
    this.patchSlot(kind, emptySlot({ lastImportedAt: this.slot(kind).lastImportedAt }));
  }

  onFileChange(kind: DataImportEntityKind, ev: Event): void {
    if (this.anyImporting()) {
      return;
    }
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    void file.arrayBuffer().then((buf) => {
      const parsed = parseDataImportWorkbookForKind(buf, kind);
      if (!parsed) {
        this.toast.show(
          `No hay filas con datos para ${KIND_LABEL[kind]}. Revisa encabezados y plantilla.`,
          'warning',
        );
        this.patchSlot(kind, emptySlot({ lastImportedAt: this.slot(kind).lastImportedAt }));
        return;
      }
      const count = parsed.rows.length;
      const entity = KIND_LABEL[kind].toLowerCase();
      const lastImportedAt = this.slot(kind).lastImportedAt;
      this.patchSlot(kind, {
        fileName: file.name,
        preview: parsed,
        importing: false,
        progress: null,
        processing: true,
        processingMessage: `${count} ${entity} detectados, cargando…`,
        lastImportCreated: 0,
        lastImportFailures: [],
        lastImportedAt,
      });
      this.catalogLoadingKind.set(kind);
      this.catalogLoader
        .loadSnapshot()
        .pipe(
          switchMap((catalog) => {
            const label = `${count} ${entity} detectados`;
            this.patchSlot(kind, {
              ...this.slots()[kind],
              processingMessage: `${label}, validando con la base de datos…`,
            });
            let rows = applyDataImportUniquenessRules(parsed.rows, catalog);
            if (kind !== 'clients') {
              return of(rows);
            }
            return enrichClientImportRowsWithGeo(rows, this.geo, (cur, tot) => {
              this.patchSlot(kind, {
                ...this.slots()[kind],
                processingMessage: `${tot} clientes detectados, validando entregas (${cur}/${tot})…`,
              });
            }).pipe(map((enriched) => applyDataImportUniquenessRules(enriched, catalog)));
          }),
          finalize(() => this.catalogLoadingKind.set(null)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (rows) => {
            this.patchSlot(kind, {
              fileName: file.name,
              preview: { ...parsed, rows },
              importing: false,
              progress: null,
              processing: false,
              processingMessage: null,
              lastImportCreated: 0,
              lastImportFailures: [],
              lastImportedAt: this.slot(kind).lastImportedAt,
            });
            const errors = rows.filter((r) => r.status === 'error').length;
            if (errors > 0) {
              this.toast.show(
                `${KIND_LABEL[kind]}: ${errors} fila(s) con error o duplicado; no se importarán.`,
                'warning',
              );
            } else {
              this.toast.show(
                `${KIND_LABEL[kind]}: vista previa lista.`,
                'success',
              );
            }
          },
          error: () => {
            this.toast.show(
              'No se pudo validar el archivo contra la base de datos; intenta de nuevo.',
              'error',
            );
            this.patchSlot(kind, emptySlot({ lastImportedAt: this.slot(kind).lastImportedAt }));
          },
        });
    });
  }

  runImport(kind: DataImportEntityKind): void {
    if (!this.canImportKind(kind)) {
      return;
    }
    const preview = this.slot(kind).preview;
    if (!preview) {
      return;
    }
    this.patchSlot(kind, {
      ...this.slot(kind),
      importing: true,
      progress: null,
      lastImportCreated: 0,
      lastImportFailures: [],
    });

    this.catalogLoader
      .loadSnapshot()
      .pipe(
        switchMap((catalog) => {
          const rows = applyDataImportUniquenessRules(preview.rows, catalog);
          const blocked = rows.filter((r) => r.status === 'error').length;
          if (blocked > 0) {
            this.patchSlot(kind, {
              ...this.slot(kind),
              preview: { ...preview, rows },
              importing: false,
            });
            this.toast.show(
              `Hay ${blocked} fila(s) con duplicados o errores; corrige el archivo.`,
              'warning',
            );
            throw new Error('import-blocked');
          }
          const toSave = rows.filter((r) => r.status === 'ready').length;
          let processed = 0;
          return this.importRunner.runImport(rows, new Set([kind]), (p) => {
            if (p.outcome === 'created' || p.outcome === 'failed') {
              processed += 1;
              const line =
                p.outcome === 'created'
                  ? `Fila ${p.row.rowNumber} (${p.row.summary}) guardada`
                  : `Fila ${p.row.rowNumber} (${p.row.summary}) omitida`;
              this.slots.update((prev) => ({
                ...prev,
                [kind]: {
                  ...prev[kind],
                  progress: `${processed} de ${toSave} — ${line}`,
                },
              }));
            }
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          const created = result.created[kind];
          const failed = result.failed[kind];
          const failures = result.messages
            .map(parseImportFailureMessage)
            .filter((r): r is DataImportFailureRow => r != null);
          const importedAt =
            created > 0 ? this.markModuleImported(kind) : this.slot(kind).lastImportedAt;
          if (created === 0 && failed > 0) {
            this.toast.show(`No se importó ningún registro de ${KIND_LABEL[kind]}.`, 'error');
          } else if (failed > 0) {
            this.toast.show(
              `${KIND_LABEL[kind]}: ${created} guardado(s), ${failed} omitido(s). Revisa el detalle abajo.`,
              'warning',
            );
          } else {
            this.toast.show(`${created} ${KIND_LABEL[kind].toLowerCase()} importado(s).`, 'success');
          }
          this.patchSlot(
            kind,
            failed > 0
              ? {
                  ...this.slot(kind),
                  importing: false,
                  progress: null,
                  fileName: null,
                  preview: null,
                  lastImportCreated: created,
                  lastImportFailures: failures,
                  lastImportedAt: importedAt,
                }
              : emptySlot({ lastImportedAt: importedAt ?? this.slot(kind).lastImportedAt }),
          );
        },
        error: (err: unknown) => {
          if (err instanceof Error && err.message === 'import-blocked') {
            return;
          }
          this.patchSlot(kind, { ...this.slot(kind), importing: false });
          this.toast.show('La importación se interrumpió.', 'error');
        },
      });
  }

  rowStatusClass(row: DataImportPreparedRow): string {
    return row.status === 'error' ? 'is-error' : 'is-ready';
  }

  private patchSlot(kind: DataImportEntityKind, patch: ModuleSlot): void {
    this.slots.update((prev) => ({ ...prev, [kind]: patch }));
  }
}