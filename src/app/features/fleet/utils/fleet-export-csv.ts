export interface FleetUnitTableExportRow {
  brand: string;
  model: string;
  plate: string;
  operationalStatus: string;
  maintenance: string;
  verification: string;
  insurance: string;
  configuration: string;
}

export interface FleetEquipmentTableExportRow {
  brand: string;
  model: string;
  equipmentType: string;
  plate: string;
  operationalStatus: string;
  maintenance: string;
  verification: string;
  insurance: string;
}

function csvCell(value: string): string {
  const t = value.replace(/"/g, '""');
  return /[",\n\r]/.test(t) ? `"${t}"` : t;
}

export function buildFleetUnitsCsv(rows: readonly FleetUnitTableExportRow[]): string {
  const headers = [
    'Marca',
    'Modelo',
    'Placa',
    'Estado operativo',
    'Mantenimiento',
    'Verificaciones',
    'Seguro',
    'Configuración',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.brand,
        row.model,
        row.plate,
        row.operationalStatus,
        row.maintenance,
        row.verification,
        row.insurance,
        row.configuration,
      ]
        .map((v) => csvCell(String(v)))
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function buildFleetEquipmentCsv(
  rows: readonly FleetEquipmentTableExportRow[],
): string {
  const headers = [
    'Marca',
    'Modelo',
    'Tipo de equipo',
    'Placa',
    'Estado operativo',
    'Mantenimiento',
    'Verificaciones',
    'Seguro',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.brand,
        row.model,
        row.equipmentType,
        row.plate,
        row.operationalStatus,
        row.maintenance,
        row.verification,
        row.insurance,
      ]
        .map((v) => csvCell(String(v)))
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadFleetCsv(content: string, filename: string): void {
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
