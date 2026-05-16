/** «marzo de 2021» para «Colaborador desde». */
export function formatMemberSinceLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const parts = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).formatToParts(d);
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return month && year ? `${month} de ${year}` : '—';
}

/** Antigüedad legible: «3 años y 2 meses», «8 meses», etc. */
export function formatTenureLabel(iso: string, ref = new Date()): string {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) {
    return '—';
  }
  let months =
    (ref.getFullYear() - start.getFullYear()) * 12 +
    (ref.getMonth() - start.getMonth());
  if (ref.getDate() < start.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    months = 0;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0 && rem > 0) {
    return `${years} año${years === 1 ? '' : 's'} y ${rem} mes${rem === 1 ? '' : 'es'}`;
  }
  if (years > 0) {
    return `${years} año${years === 1 ? '' : 's'}`;
  }
  if (rem > 0) {
    return `${rem} mes${rem === 1 ? '' : 'es'}`;
  }
  return 'Menos de un mes';
}
