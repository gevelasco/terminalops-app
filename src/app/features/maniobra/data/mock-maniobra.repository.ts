import { Injectable } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';
import { MOCK_TRIPS } from '@app/mock-data/mock-trips';
import { Trip } from '@shared/models/logistics.models';
import {
  buildManeuverCode,
  initialsFromClientName,
  parseManeuverSequenceSuffix,
} from '@shared/utils/maneuver-code';
import {
  CancelManiobraPayload,
  CreateTripPayload,
  ManiobraRepository,
} from './maniobra.repository';

@Injectable()
export class MockManiobraRepository extends ManiobraRepository {
  private maniobras: Trip[] = [...MOCK_TRIPS];

  override list(): Observable<Trip[]> {
    return of([...this.maniobras]).pipe(delay(280));
  }

  override get(id: string): Observable<Trip | undefined> {
    const trip = this.maniobras.find((t) => t.id === id);
    return of(trip).pipe(delay(90));
  }

  /** Correlativo global tomado del mayor sufijo numérico ya usado en códigos. */
  private nextManeuverSequence(): number {
    let max = 0;
    for (const t of this.maniobras) {
      const n = parseManeuverSequenceSuffix(t.maneuverCode);
      if (n > max) {
        max = n;
      }
    }
    return max + 1;
  }

  override create(payload: CreateTripPayload): Observable<Trip> {
    const op = payload.operationType;
    const equipment =
      payload.equipment.length > 0
        ? [...payload.equipment]
        : op === 'full'
          ? ['Equipo principal', 'Semirremolque / segundo equipo']
          : ['Equipo principal'];
    const clientLabel = payload.clientName?.trim() || 'Cliente general';
    const initials = initialsFromClientName(clientLabel);
    const seq = this.nextManeuverSequence();
    const maneuverCode = buildManeuverCode(initials, seq);
    const programmedAt = new Date().toISOString();
    const billing = !!payload.clientName?.trim();
    const trip: Trip = {
      id: maneuverCode,
      maneuverCode,
      origin: payload.origin.trim(),
      destination: payload.destination.trim(),
      clientName: clientLabel,
      unitId: payload.unitId,
      operatorId: payload.operatorId.trim(),
      status: 'scheduled',
      programmedAt,
      scheduledAt: programmedAt,
      operationType: op,
      loadType: payload.loadType,
      containerType: payload.containerType,
      approximateWeightTons: payload.approximateWeightTons.trim(),
      equipment,
      departureAt: payload.departureAt,
      arrivedAt: payload.arrivedAt,
      returnAt: null,
      creditDays: payload.creditDays,
      hasIncident: false,
      incidents: [],
      hasClientBilling: billing,
      dieselLiters: payload.dieselLiters,
      dieselAmount: payload.dieselAmount,
      casetasAmount: payload.casetasAmount,
      operatorQuota: payload.operatorQuota,
      clientCharge: payload.clientCharge,
      paymentMethod: payload.paymentMethod,
      requiresInvoice: payload.requiresInvoice,
      attachedDocumentFileNames:
        payload.attachedDocumentFileNames.length > 0
          ? [...payload.attachedDocumentFileNames]
          : undefined,
    };
    this.maniobras = [trip, ...this.maniobras];
    return of(trip).pipe(delay(320));
  }

  override cancelManiobra(
    tripId: string,
    payload: CancelManiobraPayload,
  ): Observable<Trip> {
    const note = payload.note?.trim() ?? '';
    if (payload.falseManeuver && note === '') {
      return throwError(
        () => new Error('La maniobra en falso requiere un detalle o explicación breve.'),
      );
    }
    const i = this.maniobras.findIndex((t) => t.id === tripId);
    if (i < 0) {
      return throwError(() => new Error('No se encontró la maniobra.'));
    }
    const row = this.maniobras[i];
    if (row.status === 'cancelled') {
      return of(row).pipe(delay(90));
    }
    if (row.status === 'completed') {
      return throwError(() => new Error('No se puede cancelar una maniobra ya completada.'));
    }
    const updated: Trip = {
      ...row,
      status: 'cancelled',
      falseManeuver: payload.falseManeuver === true ? true : undefined,
      cancellationNote: note !== '' ? note : undefined,
    };
    this.maniobras = [...this.maniobras.slice(0, i), updated, ...this.maniobras.slice(i + 1)];
    return of(updated).pipe(delay(220));
  }

  override addIncident(tripId: string, description: string): Observable<Trip> {
    const i = this.maniobras.findIndex((t) => t.id === tripId);
    const text = description.trim();
    if (i < 0 || text === '') {
      return throwError(() => new Error('Maniobra no encontrada o incidente vacío.'));
    }
    const occurredAt = new Date().toISOString();
    const incId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `inc-${occurredAt}`;
    const row = this.maniobras[i];
    const prev = row.incidents ? [...row.incidents] : [];
    const incident = { id: incId, description: text, occurredAt };
    const updated: Trip = {
      ...row,
      incidents: [incident, ...prev],
      hasIncident: true,
    };
    this.maniobras = [...this.maniobras.slice(0, i), updated, ...this.maniobras.slice(i + 1)];
    return of(updated).pipe(delay(180));
  }
}
