import type { OperatorOperationalStatus } from '@shared/models/logistics.models';

/** Pastilla de estado operativo (tablas): alineada con maniobras y flota en servicio. */
export function operatorOperationalPillClass(
  status: OperatorOperationalStatus,
): string {
  const base = 'to-table-pill';
  switch (status) {
    case 'available':
      return `${base} ${base}--fleet-available`;
    case 'in_use':
      return `${base} ${base}--course`;
    case 'scheduled':
      return `${base} ${base}--fleet-scheduled`;
    case 'maintenance':
      return `${base} ${base}--fleet-maintenance`;
    case 'incapacitated':
      return `${base} ${base}--operator-incapacitated`;
    case 'leave':
      return `${base} ${base}--operator-leave`;
    case 'inactive':
      return `${base} ${base}--operator-inactive`;
    default:
      return `${base} ${base}--fleet-unknown`;
  }
}

/** Franja de estado en drawer (misma convención que `fleet-unit-detail`). */
export function operatorOperationalStatusMod(
  status: OperatorOperationalStatus,
): string {
  switch (status) {
    case 'available':
      return 'fleet-unit-detail__status--available';
    case 'in_use':
      return 'fleet-unit-detail__status--route';
    case 'scheduled':
      return 'fleet-unit-detail__status--scheduled';
    case 'maintenance':
      return 'fleet-unit-detail__status--maintenance';
    case 'incapacitated':
      return 'fleet-unit-detail__status--operator-incapacitated';
    case 'leave':
      return 'fleet-unit-detail__status--operator-leave';
    case 'inactive':
      return 'fleet-unit-detail__status--operator-inactive';
    default:
      return 'fleet-unit-detail__status--unknown';
  }
}
