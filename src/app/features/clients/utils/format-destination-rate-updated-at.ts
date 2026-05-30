/** Formato visible: dd/mm/yyyy hh:mm (24 h). */
export function formatDestinationRateUpdatedAt(iso: string | undefined): string {
  const t = (iso ?? '').trim();
  if (!t) {
    return '—';
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
