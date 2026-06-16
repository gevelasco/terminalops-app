/** Convierte valor de `<input type="datetime-local">` (`yyyy-mm-ddTHH:mm`) a ISO UTC. */
export function dateTimeLocalValueToIso(local: string): string | null {
  const t = local.trim();
  if (!t) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) {
    return null;
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

/** Convierte ISO UTC a valor `datetime-local` en zona local del navegador. */
export function isoToDateTimeLocalValue(iso: string | null | undefined): string {
  const raw = iso?.trim();
  if (!raw) {
    return '';
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Compara ISO normalizados (ms). */
export function sameScheduleInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a?.trim();
  const right = b?.trim();
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  const leftMs = new Date(left).getTime();
  const rightMs = new Date(right).getTime();
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
    return false;
  }
  return Math.abs(leftMs - rightMs) < 1000;
}
