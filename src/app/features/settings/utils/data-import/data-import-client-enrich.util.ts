import { concatMap, from, map, Observable, of, toArray } from 'rxjs';
import type { GeoApiService } from '@core/services/api/geo';
import type { CreateClientPayload } from '@shared/models/client.models';
import type { DataImportPreparedRow } from './data-import.types';

export function enrichClientImportRowsWithGeo(
  rows: readonly DataImportPreparedRow[],
  geo: GeoApiService,
  onStep?: (current: number, total: number) => void,
): Observable<DataImportPreparedRow[]> {
  const clientRows = rows.filter((r) => r.kind === 'clients');
  const total = clientRows.length;
  let step = 0;

  return from(rows).pipe(
    concatMap((row) => {
      if (row.kind !== 'clients' || row.status === 'error') {
        return of(row);
      }
      const payload = row.payload as CreateClientPayload;
      const delivery = payload.deliveries?.[0];
      const cp = delivery?.postalCode?.trim();
      if (!cp || cp.length !== 5) {
        step += 1;
        onStep?.(step, total);
        return of(row);
      }
      return geo
        .settlementCoordinates({
          postalCode: cp,
          settlement: delivery?.locality,
          municipality: delivery?.cityMunicipality,
        })
        .pipe(
          map((coords) => {
            step += 1;
            onStep?.(step, total);
            const warnings = [...row.warnings];
            const deliveries = [...(payload.deliveries ?? [])];
            const first = deliveries[0];
            if (!first) {
              return row;
            }
            if (coords) {
              deliveries[0] = {
                ...first,
                latitude: coords.lat,
                longitude: coords.lon,
              };
            } else if (delivery?.locality || delivery?.cityMunicipality) {
              warnings.push(
                'No se obtuvieron coordenadas para la entrega; se guardará CP y localidad.',
              );
            } else {
              warnings.push(
                'Solo CP de entrega: completa municipio/localidad en el Excel para geocodificar.',
              );
            }
            const nextPayload: CreateClientPayload = {
              ...payload,
              deliveries,
            };
            return { ...row, payload: nextPayload, warnings };
          }),
        );
    }),
    toArray(),
  );
}