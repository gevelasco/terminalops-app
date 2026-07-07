import { cadenceToMonths } from './fleet-insurance-payment.util';

/** Concepto del gasto según periodicidad. */
export function insurancePolicyConceptLabel(cadence: string | undefined): string {
  const months = cadenceToMonths(cadence);
  if (months === 1) {
    return 'Póliza - mensual';
  }
  if (months === 3) {
    return 'Póliza - trimestral';
  }
  if (months === 12) {
    return 'Póliza - anual';
  }
  const raw = (cadence ?? '').trim().toLowerCase();
  if (raw === 'weekly' || raw === 'semanal') {
    return 'Póliza - semanal';
  }
  return 'Póliza';
}
