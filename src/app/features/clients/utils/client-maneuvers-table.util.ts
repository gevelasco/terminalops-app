import type { Expense, Trip } from '@shared/models/logistics.models';
import { isoDayInRange } from '@features/reports/utils/reports-filter';
import { parseMoney } from '@features/reports/utils/reports-money';
import {
  isTripClientCollected,
  tripCreditReceivable,
  tripResolvedDirectCost,
  tripRevenue,
} from '@features/reports/utils/reports-trip-helpers';
import { tripCompletionIso, tripDepartureIso } from '@features/trips/utils/trip-schedule-accessors';

export type ClientManeuverCollectedStatus = 'collected' | 'pending' | 'na';

export interface ClientManeuverPeriodTotals {
  count: number;
  totalPactado: number;
  totalCostos: number;
  totalCredito: number;
  utilidad: number;
  marginPct: number;
}

function tripMatchesClient(t: Trip, clientId: string): boolean {
  const id = clientId.trim();
  if (!id) {
    return false;
  }
  return (t.clientId ?? '').trim() === id;
}

function municipalityFromCityMunicipalityLine(line: string | null | undefined): string {
  const t = (line ?? '').trim();
  if (!t) {
    return '';
  }
  const comma = t.indexOf(',');
  return (comma >= 0 ? t.slice(0, comma) : t).trim();
}

function stateFromCityMunicipalityLine(line: string | null | undefined): string {
  const t = (line ?? '').trim();
  if (!t) {
    return '';
  }
  const comma = t.indexOf(',');
  return comma >= 0 ? t.slice(comma + 1).trim() : '';
}

/** Municipio y estado (sin CP). */
export function formatClientManeuverDestinationLabel(trip: Trip): string {
  const line = trip.destinationCityMunicipality?.trim() ?? '';
  const municipality = municipalityFromCityMunicipalityLine(line);
  const state = stateFromCityMunicipalityLine(line);
  if (municipality && state) {
    return `${municipality}, ${state}`;
  }
  if (municipality) {
    return municipality;
  }
  if (state) {
    return state;
  }
  return '—';
}

export function formatClientManeuverDepartureLabel(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  }).format(d);
}

/** Cobrada si hay confirmación; pendiente si aún no (`clientCollectedAt` vacío). */
export function tripCollectedStatusForRow(trip: Trip): ClientManeuverCollectedStatus {
  if (trip.hasClientBilling === false) {
    return 'na';
  }
  const amount = parseMoney(trip.clientCharge) || tripRevenue(trip);
  if (amount <= 0) {
    return 'na';
  }
  if (isTripClientCollected(trip)) {
    return 'collected';
  }
  return 'pending';
}

export function filterClientCompletedManeuversInPeriod(
  clientId: string,
  trips: readonly Trip[],
  from: string,
  to: string,
): Trip[] {
  return trips
    .filter((t) => {
      if (!tripMatchesClient(t, clientId)) {
        return false;
      }
      if (t.status !== 'completed') {
        return false;
      }
      const iso = tripCompletionIso(t);
      if (!iso) {
        return false;
      }
      return isoDayInRange(iso, from, to);
    })
    .sort((a, b) => {
      const aIso = tripCompletionIso(a) ?? '';
      const bIso = tripCompletionIso(b) ?? '';
      return bIso.localeCompare(aIso);
    });
}

export function buildClientManeuverPeriodTotals(
  trips: readonly Trip[],
  expenses: readonly Expense[] = [],
): ClientManeuverPeriodTotals {
  let totalPactado = 0;
  let totalCostos = 0;
  let totalCredito = 0;
  for (const trip of trips) {
    totalPactado += parseMoney(trip.clientCharge) || tripRevenue(trip);
    totalCostos += tripResolvedDirectCost(trip, expenses);
    totalCredito += tripCreditReceivable(trip);
  }
  const utilidad = totalPactado - totalCostos;
  const marginPct =
    totalPactado > 0 ? Math.round((utilidad / totalPactado) * 100) : 0;
  return {
    count: trips.length,
    totalPactado,
    totalCostos,
    totalCredito,
    utilidad,
    marginPct,
  };
}

export function buildClientManeuverTableRows(
  trips: readonly Trip[],
  formatMoney: (value: number) => string,
  expenses: readonly Expense[] = [],
): Record<string, unknown>[] {
  return trips.map((trip) => ({
    id: trip.id,
    maneuverCode: trip.maneuverCode,
    departureAt: formatClientManeuverDepartureLabel(tripDepartureIso(trip)),
    destination: formatClientManeuverDestinationLabel(trip),
    operationType: trip.operationType,
    operationConfigurationId: trip.operationConfigurationId ?? '',
    clientCharge: formatMoney(parseMoney(trip.clientCharge) || tripRevenue(trip)),
    costs: formatMoney(tripResolvedDirectCost(trip, expenses)),
    collectedStatus: tripCollectedStatusForRow(trip),
  }));
}
