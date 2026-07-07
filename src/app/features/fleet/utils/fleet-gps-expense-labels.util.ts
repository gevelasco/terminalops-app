import { cadenceToMonths } from './fleet-gps-payment.util';

/** Concepto del gasto según periodicidad del servicio GPS. */
export function gpsServiceConceptLabel(cadence: string | undefined): string {
  const months = cadenceToMonths(cadence);
  if (months === 1) {
    return 'GPS - mensual';
  }
  if (months === 3) {
    return 'GPS - trimestral';
  }
  if (months === 12) {
    return 'GPS - anual';
  }
  const raw = (cadence ?? '').trim().toLowerCase();
  if (raw === 'weekly' || raw === 'semanal') {
    return 'GPS - semanal';
  }
  return 'GPS';
}
