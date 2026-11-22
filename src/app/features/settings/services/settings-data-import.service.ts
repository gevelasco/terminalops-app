import { Injectable, inject } from '@angular/core';
import {
  catchError,
  concatMap,
  from,
  map as rxMap,
  Observable,
  of,
  reduce,
} from 'rxjs';
import { ClientsService as ClientsApiService } from '@core/services/api/clients';
import { EquipmentService as EquipmentApiService } from '@core/services/api/equipment';
import { OperatorsService as OperatorsApiService } from '@core/services/api/operators';
import { UnitsService as UnitsApiService } from '@core/services/api/units';
import type { CreateClientPayload } from '@shared/models/client.models';
import type { CreateEquipmentPayload, CreateUnitPayload } from '@shared/models/api/api-fleet.model';
import type { Operator } from '@shared/models/logistics.models';
import { dataImportHttpErrorMessage } from '@features/settings/utils/data-import/data-import-http-error.util';
import {
  DATA_IMPORT_KIND_ORDER,
  type DataImportEntityKind,
  type DataImportPreparedRow,
  type DataImportRunResult,
} from '@features/settings/utils/data-import/data-import.types';

export type DataImportProgress = {
  kind: DataImportEntityKind;
  row: DataImportPreparedRow;
  outcome: 'created' | 'failed' | 'skipped';
  detail?: string;
};

type ImportItemResult = {
  row: DataImportPreparedRow;
  ok: boolean;
  detail?: string;
};

@Injectable({ providedIn: 'root' })
export class SettingsDataImportService {
  private readonly clientsApi = inject(ClientsApiService);
  private readonly operatorsApi = inject(OperatorsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly equipmentApi = inject(EquipmentApiService);

  runImport(
    rows: readonly DataImportPreparedRow[],
    kinds: ReadonlySet<DataImportEntityKind>,
    onProgress?: (p: DataImportProgress) => void,
  ) {
    const filtered = DATA_IMPORT_KIND_ORDER.flatMap((kind) => {
      if (!kinds.has(kind)) {
        return [];
      }
      return rows.filter((r) => r.kind === kind);
    });

    const initial: DataImportRunResult = {
      created: { clients: 0, operators: 0, units: 0, equipment: 0 },
      failed: { clients: 0, operators: 0, units: 0, equipment: 0 },
      messages: [],
    };

    return from(filtered).pipe(
      concatMap((row) => this.importOneRow(row, onProgress)),
      reduce((acc, item: ImportItemResult) => {
        const kind = item.row.kind;
        if (item.ok) {
          acc.created[kind] += 1;
        } else {
          acc.failed[kind] += 1;
          if (item.detail) {
            acc.messages.push(
              `${item.row.kind} fila ${item.row.rowNumber} (${item.row.summary}): ${item.detail}`,
            );
          }
        }
        return acc;
      }, initial),
    );
  }

  private importOneRow(
    row: DataImportPreparedRow,
    onProgress?: (p: DataImportProgress) => void,
  ): Observable<ImportItemResult> {
    if (row.status === 'error') {
      const detail = row.errors.join(' ');
      onProgress?.({ kind: row.kind, row, outcome: 'skipped', detail });
      return of({ row, ok: false, detail });
    }
    return this.postRow(row).pipe(
      rxMap(() => {
        onProgress?.({ kind: row.kind, row, outcome: 'created' });
        return { row, ok: true };
      }),
      catchError((err: unknown) => {
        const detail = dataImportHttpErrorMessage(err);
        onProgress?.({ kind: row.kind, row, outcome: 'failed', detail });
        return of({ row, ok: false, detail });
      }),
    );
  }

  private postRow(row: DataImportPreparedRow): Observable<unknown> {
    switch (row.kind) {
      case 'clients':
        return this.clientsApi.postClient(row.payload as CreateClientPayload);
      case 'operators':
        return this.operatorsApi.postOperator(row.payload as Omit<Operator, 'id'>);
      case 'units':
        return this.unitsApi.postUnit(row.payload as CreateUnitPayload);
      case 'equipment':
        return this.equipmentApi.postEquipment(row.payload as CreateEquipmentPayload);
    }
  }
}