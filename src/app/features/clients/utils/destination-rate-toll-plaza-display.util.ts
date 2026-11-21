export function isDestinationRateTollPlazaNameUnresolved(name: string): boolean {
  const t = name.trim().toLowerCase();
  return !t || t === 'n/d' || t === 'nd' || t === 's/d' || t === 'caseta';
}