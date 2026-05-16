import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/** Un asentamiento asociado a un código postal (SEPOMex). */
export interface MxPostalSettlement {
  postalCode: string;
  settlement: string;
  settlementType: string;
  municipality: string;
  state: string;
  city: string;
  settlementConsId: string;
}

interface SepomexCpPayload {
  total_records?: number;
  postcodes?: SepomexRawRow[];
}

interface SepomexCpJson {
  data?: SepomexCpPayload;
  error?: unknown;
}

interface SepomexRawRow {
  d_codigo: string;
  d_asenta: string;
  d_tipo_asenta: string;
  d_mnpio: string;
  d_estado: string;
  d_ciudad: string;
  id_asenta_cpcons: string;
}

/**
 * Catálogo SEPOMex vía API pública (solo México).
 * @see https://sepomex.nitrostudio.com.mx/
 */
@Injectable({ providedIn: 'root' })
export class MexicoPostalCodeService {
  private readonly http = inject(HttpClient);

  private static readonly apiBase =
    'https://sepomex.nitrostudio.com.mx/api/20241116/cp';

  /** CP de 5 dígitos; devuelve lista vacía si el formato no es válido o hay error de red. */
  lookupByPostalCode(postalCode: string): Observable<MxPostalSettlement[]> {
    const cp = postalCode.replace(/\D/g, '').slice(0, 5);
    if (cp.length !== 5) {
      return of([]);
    }
    const url = `${MexicoPostalCodeService.apiBase}/${cp}.json`;
    return this.http.get<SepomexCpJson>(url).pipe(
      map((res) => this.mapRows(res?.data?.postcodes ?? [], cp)),
      catchError(() => of([])),
    );
  }

  private mapRows(raw: SepomexRawRow[], cpFallback: string): MxPostalSettlement[] {
    const mapped: MxPostalSettlement[] = raw.map((r) => ({
      postalCode: (r.d_codigo ?? cpFallback).trim(),
      settlement: (r.d_asenta ?? '').trim(),
      settlementType: (r.d_tipo_asenta ?? '').trim(),
      municipality: (r.d_mnpio ?? '').trim(),
      state: (r.d_estado ?? '').trim(),
      city: (r.d_ciudad ?? '').trim(),
      settlementConsId: String(r.id_asenta_cpcons ?? '').trim(),
    }));
    const dedup = new Map<string, MxPostalSettlement>();
    for (const m of mapped) {
      const k = `${m.settlementConsId}|${m.settlement}|${m.municipality}`;
      if (!dedup.has(k)) {
        dedup.set(k, m);
      }
    }
    return [...dedup.values()].sort((a, b) =>
      a.settlement.localeCompare(b.settlement, 'es-MX', { sensitivity: 'base' }),
    );
  }
}
