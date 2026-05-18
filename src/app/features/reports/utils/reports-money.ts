const mxn0 = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

const mxn2 = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

export function parseMoney(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  const t = String(raw ?? '').trim();
  if (!t) {
    return 0;
  }
  const n = Number(t.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function formatMxn(amount: number, decimals = false): string {
  return decimals ? mxn2.format(amount) : mxn0.format(amount);
}

export function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

export function deltaLabel(current: number, previous: number): {
  label: string;
  tone: 'up' | 'down' | 'neutral';
} {
  if (previous === 0) {
    return current > 0
      ? { label: 'Sin base periodo anterior', tone: 'neutral' }
      : { label: 'Sin cambio', tone: 'neutral' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) {
    return { label: `+${pct}% vs periodo anterior`, tone: 'up' };
  }
  if (pct < 0) {
    return { label: `${pct}% vs periodo anterior`, tone: 'down' };
  }
  return { label: 'Igual al periodo anterior', tone: 'neutral' };
}
