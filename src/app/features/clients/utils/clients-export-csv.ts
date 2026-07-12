export interface ClientTableExportRow {
  client: string;
  rfc: string;
  relationshipStartedOn: string;
  creditDays: string;
  creditVolume: string;
  maneuverCount: string;
}

function csvCell(value: string): string {
  const t = value.replace(/"/g, '""');
  return /[",\n\r]/.test(t) ? `"${t}"` : t;
}

export function buildClientsCsv(rows: readonly ClientTableExportRow[]): string {
  const headers = [
    'Cliente',
    'RFC',
    'Sociedad desde',
    'Crédito (días)',
    'Volumen de crédito',
    'Maniobras',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.client,
        row.rfc,
        row.relationshipStartedOn,
        row.creditDays,
        row.creditVolume,
        row.maneuverCount,
      ]
        .map((v) => csvCell(String(v)))
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadClientsCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
