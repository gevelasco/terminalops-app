export function formatReportsChartAxisDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map((v) => Number(v));
  if (!y || !m || !d) {
    return dateKey;
  }
  const dt = new Date(y, m - 1, d);
  const day = new Intl.DateTimeFormat('es-MX', { day: '2-digit' }).format(dt);
  const month = new Intl.DateTimeFormat('es-MX', { month: 'short' })
    .format(dt)
    .replace('.', '')
    .toUpperCase();
  return `${day} ${month}`;
}

export function reportsChartAxisInterval(labelCount: number): number {
  return Math.max(0, Math.floor(labelCount / 6) - 1);
}

export function formatReportsMoneyMx(value: number, compact = false): string {
  if (compact) {
    return new Intl.NumberFormat('es-MX', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}
