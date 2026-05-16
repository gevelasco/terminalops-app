/** Etiqueta legible (es-MX) para `licenseExpiresOn` ISO `YYYY-MM-DD`. */
export function operatorLicenseExpiresLabelFromIso(iso: string): string {
  const t = iso.trim();
  if (!t) {
    return '';
  }
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return t;
  }
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
