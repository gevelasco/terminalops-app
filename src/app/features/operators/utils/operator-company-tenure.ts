/** Antigüedad legible (es-MX) desde fecha de ingreso ISO `YYYY-MM-DD`. */
export function companyTenureLabelEs(hireIso: string): string {
  const t = hireIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return '—';
  }
  const hire = new Date(t + 'T12:00:00');
  if (Number.isNaN(hire.getTime())) {
    return '—';
  }
  const now = new Date();
  let months =
    (now.getFullYear() - hire.getFullYear()) * 12 +
    (now.getMonth() - hire.getMonth());
  if (now.getDate() < hire.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    return '—';
  }
  const years = Math.floor(months / 12);
  const mo = months % 12;
  if (years === 0) {
    return `${mo} mes${mo === 1 ? '' : 'es'}`;
  }
  if (mo === 0) {
    return `${years} año${years === 1 ? '' : 's'}`;
  }
  return `${years} año${years === 1 ? '' : 's'} y ${mo} mes${mo === 1 ? '' : 'es'}`;
}
