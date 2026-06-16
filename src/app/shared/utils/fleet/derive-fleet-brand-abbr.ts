/** Abreviatura operativa derivada del nombre de marca (nuevas marcas sin catálogo fijo). */
export function deriveFleetBrandAbbr(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '';
  }
  const firstWord = trimmed.split(/\s+/).filter(Boolean)[0] ?? '';
  const alnum = firstWord.replace(/[^a-zA-Z0-9]/g, '');
  if (!alnum) {
    return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }
  if (alnum.length <= 3) {
    return alnum.toUpperCase();
  }
  return alnum.slice(0, 3).toUpperCase();
}
