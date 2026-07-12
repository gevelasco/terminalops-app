export interface ExpenseTableExportRow {
  rubroLabel: string;
  category: string;
  maneuver: string;
  fleetRelation: string;
  amount: string;
  paymentMethod: string;
  incurredAt: string;
  invoiceRequired: string;
}

function csvCell(value: string): string {
  const t = value.replace(/"/g, '""');
  return /[",\n\r]/.test(t) ? `"${t}"` : t;
}

export function buildExpensesCsv(rows: readonly ExpenseTableExportRow[]): string {
  const headers = [
    'Rubro',
    'Concepto',
    'Maniobra',
    'Flota / operador',
    'Monto',
    'Método de pago',
    'Fecha',
    'Factura',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.rubroLabel,
        row.category,
        row.maneuver,
        row.fleetRelation,
        row.amount,
        row.paymentMethod,
        row.incurredAt,
        row.invoiceRequired,
      ]
        .map((v) => csvCell(String(v)))
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadExpensesCsv(content: string, filename: string): void {
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
