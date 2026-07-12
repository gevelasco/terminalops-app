export interface OperatorTableExportRow {
  name: string;
  licenseNumber: string;
  licenseExpiresOn: string;
  operationalStatus: string;
  coverageKind: string;
  maneuverCount: string;
}

function csvCell(value: string): string {
  const t = value.replace(/"/g, '""');
  return /[",\n\r]/.test(t) ? `"${t}"` : t;
}

export function buildOperatorsCsv(rows: readonly OperatorTableExportRow[]): string {
  const headers = [
    'Nombre',
    'Licencia',
    'Vigencia',
    'Estado operativo',
    'Tipo de cobertura',
    'Maniobras',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.licenseNumber,
        row.licenseExpiresOn,
        row.operationalStatus,
        row.coverageKind,
        row.maneuverCount,
      ]
        .map((v) => csvCell(String(v)))
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadOperatorsCsv(content: string, filename: string): void {
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
