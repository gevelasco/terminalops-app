import type { CriticalAlert } from '@shared/models/logistics.models';

/**
 * @deprecated Las alertas críticas se derivan de `Trip.incidents` vía
 * `buildCriticalAlertsFromTrips` en sim-db. Este arreglo queda vacío por compatibilidad.
 */
export const MOCK_CRITICAL_ALERTS: CriticalAlert[] = [];
