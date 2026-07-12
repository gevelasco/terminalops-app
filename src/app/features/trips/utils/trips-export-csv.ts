export interface ManiobraListExportRow {
  code: string;
  route: string;
  clientName: string;
  operatorName: string;
  unitId: string;
  status: string;
  departureAt: string;
  arrivedAt: string;
  operationType: string;
  hasIncident: string;
}

function csvCell(value: string): string {
  const t = value.replace(/"/g, '""');
  return /[",\n\r]/.test(t) ? `"${t}"` : t;
}

export function buildManiobrasCsv(rows: readonly ManiobraListExportRow[]): string {
  const headers = [
    'Código',
    'Ruta',
    'Cliente',
    'Operador',
    'Unidad',
    'Estado',
    'Salida',
    'Llegada',
    'Configuración',
    'Incidente',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.code,
        row.route,
        row.clientName,
        row.operatorName,
        row.unitId,
        row.status,
        row.departureAt,
        row.arrivedAt,
        row.operationType,
        row.hasIncident,
      ]
        .map((v) => csvCell(String(v)))
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadManiobrasCsv(content: string, filename: string): void {
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
