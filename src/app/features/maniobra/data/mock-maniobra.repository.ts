import { Injectable, inject } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
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
  private readonly db = inject(SimulatedDbService);

  override list(): Observable<Trip[]> {
    return of(this.db.listTrips()).pipe(delay(280));
  }

  override get(id: string): Observable<Trip | undefined> {
    const trip = this.db.getTrip(id);
    return of(trip).pipe(delay(90));
  }

  /** Correlativo global tomado del mayor sufijo numérico ya usado en códigos. */
  private nextManeuverSequence(): number {
    let max = 0;
    for (const t of this.db.listTrips()) {
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
    const clientId =
      payload.clientId?.trim() || this.db.resolveClientIdByName(clientLabel);
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
      clientId,
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
      routeDistanceKm: payload.routeDistanceKm,
      maneuverKind: payload.maneuverKind,
      originPostalCode: payload.originPostalCode,
      originCityMunicipality: payload.originCityMunicipality,
      originLocality: payload.originLocality,
      destinationPostalCode: payload.destinationPostalCode,
      destinationCityMunicipality: payload.destinationCityMunicipality,
      destinationLocality: payload.destinationLocality,
      operatorLicenseNumber: payload.operatorLicenseNumber,
      operatorLicenseExpiresLabel: payload.operatorLicenseExpiresLabel,
    };
    this.db.prependTripRow(clientId, trip);
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
    const row = this.db.getTrip(tripId);
    if (!row) {
      return throwError(() => new Error('No se encontró la maniobra.'));
    }
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
    this.db.replaceTrip(tripId, updated);
    return of(updated).pipe(delay(220));
  }

  override addIncident(
    tripId: string,
    description: string,
    postedBy: string,
  ): Observable<Trip> {
    const text = description.trim();
    const author = postedBy.trim();
    const row = this.db.getTrip(tripId);
    if (!row || text === '' || author === '') {
      return throwError(() => new Error('Maniobra no encontrada o incidente vacío.'));
    }
    const occurredAt = new Date().toISOString();
    const incId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `inc-${occurredAt}`;
    const prev = row.incidents ? [...row.incidents] : [];
    const incident = { id: incId, description: text, occurredAt, postedBy: author };
    const updated: Trip = {
      ...row,
      incidents: [incident, ...prev],
      hasIncident: true,
    };
    this.db.replaceTrip(tripId, updated);
    return of(updated).pipe(delay(180));
  }
}
