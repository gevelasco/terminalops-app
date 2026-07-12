import type { ReportsFilter } from '../models/reports-view.models';

/** Clave estable para cachear respuestas de reportes por filtro. */
export function reportsFilterCacheKey(filter: ReportsFilter): string {
  const clients = [...filter.clientIds].sort().join(',');
  const methods = [...filter.clientPaymentMethods].sort().join(',');
  return `${filter.from}|${filter.to}|${clients}|${methods}`;
}
