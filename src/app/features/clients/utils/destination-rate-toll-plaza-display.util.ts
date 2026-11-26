export function isDestinationRateTollPlazaNameUnresolved(name: string): boolean {
  const t = name.trim().toLowerCase();
  return !t || t === 'n/d' || t === 'nd' || t === 's/d' || t === 'caseta';
}

/** Lista de casetas: [nombre], [sección]. El precio va aparte al final de la fila. */
export function formatTollPlazaListLabel(row: {
  name: string;
  section?: string | null;
}): string {
  const name = row.name.trim() || 'Caseta';
  const section = (row.section ?? '').trim();
  return section ? `${name}, ${section}` : name;
}
