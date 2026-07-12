import type { ClientCommercialHealth } from '@shared/models/client.models';

/** Pastilla de estatus comercial (tablas y cards). */
export function clientCommercialPillClass(
  health: ClientCommercialHealth | string | undefined,
): string {
  const base = 'to-table-pill';
  switch (health) {
    case 'good_standing':
      return `${base} to-table-pill--client-good`;
    case 'due_soon':
      return `${base} to-table-pill--client-due-soon`;
    case 'watch_list':
      return `${base} to-table-pill--client-watch`;
    case 'restricted':
      return `${base} to-table-pill--client-restricted`;
    case 'not_evaluated':
    default:
      return `${base} to-table-pill--client-na`;
  }
}

/** Franja de estado en drawer (misma convención que operadores). */
export function clientCommercialStatusMod(
  health: ClientCommercialHealth | string | undefined,
): string {
  switch (health) {
    case 'good_standing':
      return 'fleet-unit-detail__status--client-good';
    case 'due_soon':
      return 'fleet-unit-detail__status--client-due-soon';
    case 'watch_list':
      return 'fleet-unit-detail__status--client-watch';
    case 'restricted':
      return 'fleet-unit-detail__status--client-restricted';
    case 'not_evaluated':
    default:
      return 'fleet-unit-detail__status--client-na';
  }
}
