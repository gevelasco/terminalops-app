export function isDestinationRateTollPlazaNameUnresolved(name: string): boolean {
  const t = name.trim().toLowerCase();
  return !t || t === 'n/d' || t === 'nd' || t === 's/d' || t === 'caseta';
}

import { tollPlazaListLocationSuffix } from '@features/clients/utils/destination-rate-toll-plaza-place.util';

/** Lista de casetas (texto plano): Peaje [nombre], [municipio], [estado]. */
export function formatTollPlazaListLabel(row: {
  name: string;
  municipality?: string;
  state?: string;
}): string {
  const name = row.name.trim() || 'Caseta';
  const tail = tollPlazaListLocationSuffix(row);
  return tail ? `Peaje ${name}, ${tail}` : `Peaje ${name}`;
}