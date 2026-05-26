import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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

/**
 * Catálogo SEPOMex vía API TerminalOps (evita CORS en el navegador).
 */
@Injectable({ providedIn: 'root' })
export class MexicoPostalCodeService {
  private readonly http = inject(HttpClient);

  /** CP de 5 dígitos; devuelve lista vacía si el formato no es válido o hay error de red. */
  lookupByPostalCode(postalCode: string): Observable<MxPostalSettlement[]> {
    const cp = postalCode.replace(/\D/g, '').slice(0, 5);
    if (cp.length !== 5) {
      return of([]);
    }
    return this.http
      .get<MxPostalSettlement[]>(`${environment.apiUrl}/geo/mx/postal-codes/${cp}`)
      .pipe(
        map((rows) => (Array.isArray(rows) ? rows : [])),
        catchError(() => of([])),
      );
  }
}
