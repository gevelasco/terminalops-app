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
