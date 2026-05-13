/** Par fecha / hora para celdas `datetime-stacked` en tablas. */
export interface MxStackedDatetime {
  date: string;
  time: string;
}

export function formatStackedMx(iso: string | null | undefined): MxStackedDatetime | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  return {
    date: new Intl.DateTimeFormat('es-MX', { dateStyle: 'short' }).format(d),
    time: new Intl.DateTimeFormat('es-MX', { timeStyle: 'short' }).format(d),
  };
}
