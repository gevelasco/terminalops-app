/**
 * Tope de filas visibles en listados densos de UI (reportes / tablas HTML).
 * No limita datos de API: solo lo que se pinta de golpe.
 */
export const REPORTS_DENSE_LIST_CAP = 50;

/** Primer lote de tarjetas en overview de flota; “Ver más” suma el mismo tamaño. */
export const FLEET_OVERVIEW_PAGE_SIZE = 24;

export const FLEET_TABLE_PAGE_SIZE_OPTIONS = [10, 15, 25, 50] as const;

export type CappedListView<T> = {
  items: readonly T[];
  total: number;
  truncated: boolean;
  hiddenCount: number;
};

export function cappedListView<T>(
  items: readonly T[],
  limit: number,
): CappedListView<T> {
  const total = items.length;
  if (!Number.isFinite(limit) || limit <= 0 || total <= limit) {
    return { items, total, truncated: false, hiddenCount: 0 };
  }
  return {
    items: items.slice(0, limit),
    total,
    truncated: true,
    hiddenCount: total - limit,
  };
}

export function cappedListHint(view: CappedListView<unknown>): string | null {
  if (!view.truncated) {
    return null;
  }
  return `Mostrando ${view.items.length} de ${view.total}. Ajusta el periodo o exporta para ver el resto.`;
}
