import { formatMxn } from '@features/reports/utils/reports-money';

export interface SettlementDocumentField {
  label: string;
  value: string;
}

export interface SettlementDocumentExpenseLine {
  label: string;
  detail: string;
  incurredAtLabel: string;
  amount: number;
}

export interface ManiobraSettlementDocumentInput {
  companyName: string;
  companyTagline: string;
  companyLogoDataUrl: string | null;
  generatedAt: Date;
  generatedBy: string;
  maneuverCode: string;
  statusLabel: string;
  completedAtLabel: string;
  identification: readonly SettlementDocumentField[];
  route: readonly SettlementDocumentField[];
  cargo: readonly SettlementDocumentField[];
  assignmentOperator: readonly SettlementDocumentField[];
  assignment: readonly SettlementDocumentField[];
  billing: readonly SettlementDocumentField[];
  charged: number;
  spent: number;
  margin: number;
  marginPct: number | null;
  paymentStatusLabel: string;
  expenses: readonly SettlementDocumentExpenseLine[];
}

export interface ManiobraSettlementDocument {
  fileTitle: string;
  html: string;
}

export function settlementDocumentSheetMark(
  maneuverCode: string,
  generatedAt: Date = new Date(),
): string {
  const code = maneuverCode.trim() || 'maniobra';
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${pad(generatedAt.getDate())}/${pad(generatedAt.getMonth() + 1)}/${generatedAt.getFullYear()}`;
  return `Liquidacion ${code} ${date}`;
}

export function settlementDocumentFileTitle(
  maneuverCode: string,
  generatedAt: Date = new Date(),
): string {
  const code = maneuverCode.trim().replace(/[^\w.-]+/g, '_') || 'maniobra';
  const y = generatedAt.getFullYear();
  const m = String(generatedAt.getMonth() + 1).padStart(2, '0');
  const d = String(generatedAt.getDate()).padStart(2, '0');
  return `Liquidacion_${code}_${y}${m}${d}`;
}

export function escapeSettlementHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(amount: number): string {
  return formatMxn(amount, true);
}

function safeLogoSrc(raw: string | null | undefined): string | null {
  const src = raw?.trim() ?? '';
  return src.startsWith('data:image/') ? src : null;
}

function fieldsHtml(
  fields: readonly SettlementDocumentField[],
  className = 'fields',
): string {
  if (fields.length === 0) {
    return '';
  }
  return `<dl class="${className}">${fields
    .map(
      (field) =>
        `<div class="field"><dt>${escapeSettlementHtml(field.label)}</dt><dd>${escapeSettlementHtml(field.value)}</dd></div>`,
    )
    .join('')}</dl>`;
}

function expensesHtml(lines: readonly SettlementDocumentExpenseLine[]): string {
  if (lines.length === 0) {
    return '<p class="empty">No hay gastos registrados para esta maniobra.</p>';
  }
  const rows = lines
    .map(
      (line) => `<tr>
        <td>
          <strong>${escapeSettlementHtml(line.label)}</strong>
          <span class="muted">${escapeSettlementHtml(line.detail)}</span>
        </td>
        <td class="nowrap">${escapeSettlementHtml(line.incurredAtLabel)}</td>
        <td class="num">${escapeSettlementHtml(money(line.amount))}</td>
      </tr>`,
    )
    .join('');
  return `<table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th>Fecha</th>
        <th class="num">Importe</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function renderManiobraSettlementDocumentHtml(
  input: ManiobraSettlementDocumentInput,
): string {
  const company = input.companyName.trim() || 'TerminalOps';
  const tagline = input.companyTagline.trim() || 'Operaciones logísticas';
  const completedAtLabel = input.completedAtLabel.trim() || '—';
  const sheetMark = settlementDocumentSheetMark(
    input.maneuverCode,
    input.generatedAt,
  );
  const logoSrc = safeLogoSrc(input.companyLogoDataUrl);
  const marginPct =
    input.marginPct == null ? '—' : `${input.marginPct}%`;
  const marginClass = input.margin < 0 ? ' kpi--neg' : '';
  const logo = logoSrc
    ? `<img class="logo" src="${logoSrc}" alt="" />`
    : `<div class="logo-fallback">${escapeSettlementHtml(company.slice(0, 1).toUpperCase())}</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>&#8203;</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: #122033;
      background: #fff;
      font: 10.5pt/1.45 "Segoe UI", Calibri, "Helvetica Neue", Arial, sans-serif;
    }
    .sheet {
      box-sizing: border-box;
      min-height: 297mm;
      max-width: 210mm;
      margin: 0 auto;
      padding: 14mm 14mm 12mm;
      display: flex;
      flex-direction: column;
    }
    .sheet-body { flex: 1 1 auto; }
    .sheet-foot {
      flex: 0 0 auto;
      margin-top: auto;
      padding-top: 10mm;
      text-align: center;
      font-size: 8pt;
      letter-spacing: 0.04em;
      color: #5b6b7c;
    }
    .sheet--economics {
      break-before: page;
      page-break-before: always;
    }
    header {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 54px;
      padding-bottom: 12px;
      border-bottom: 2.5px solid #0e2a47;
    }
    .logo, .logo-fallback {
      position: absolute;
      left: 0;
      top: 0;
      width: 54px;
      height: 54px;
      object-fit: cover;
      object-position: center;
      border-radius: 6px;
    }
    .letterhead-center {
      flex: 1;
      text-align: center;
      padding: 0 58px 0 62px;
      min-width: 0;
    }
    .logo-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0e2a47;
      color: #fff;
      font-weight: 700;
      font-size: 18pt;
    }
    .letterhead-center h1 {
      margin: 0;
      font-size: 13.5pt;
      letter-spacing: 0.01em;
    }
    .letterhead-center p { margin: 2px 0 0; color: #5b6b7c; font-size: 9pt; }
    .code {
      position: absolute;
      right: 0;
      top: 0;
      display: inline-block;
      padding: 3px 8px;
      border: 1px solid #0e2a47;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .banner {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin: 10px 0 14px;
      padding: 8px 10px;
      background: #f3f6f9;
      border: 1px solid #d5dde6;
      font-size: 8.5pt;
    }
    .banner strong { color: #0e2a47; }
    section { margin: 0 0 13px; break-inside: avoid; }
    h3 {
      margin: 0 0 7px;
      padding-bottom: 4px;
      border-bottom: 1px solid #d5dde6;
      font-size: 9.5pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0e2a47;
    }
    .fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px 18px;
      margin: 0;
    }
    .fields + .fields { margin-top: 8px; }
    .fields--3 { grid-template-columns: 1fr 1fr 1fr; }
    .field { display: grid; gap: 1px; }
    dt {
      margin: 0;
      font-size: 7.5pt;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #5b6b7c;
    }
    dd { margin: 0; font-weight: 600; font-size: 10pt; }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .kpi {
      padding: 8px 10px;
      border: 1px solid #d5dde6;
      background: #f8fafc;
    }
    .kpi span {
      display: block;
      font-size: 7.5pt;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #5b6b7c;
    }
    .kpi strong {
      display: block;
      margin-top: 3px;
      font-size: 12pt;
      font-variant-numeric: tabular-nums;
    }
    .kpi--neg strong { color: #9b1c1c; }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 6px 8px;
      border-bottom: 1px solid #d5dde6;
      text-align: left;
      vertical-align: top;
    }
    th {
      font-size: 7.5pt;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #5b6b7c;
      background: #f3f6f9;
    }
    td strong { display: block; }
    td .muted { display: block; color: #5b6b7c; font-size: 8.5pt; font-weight: 400; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .nowrap { white-space: nowrap; }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-top: 6px;
      font-weight: 700;
    }
    .empty { margin: 0; color: #5b6b7c; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="sheet-body">
    <header>
      ${logo}
      <div class="letterhead-center">
        <h1>${escapeSettlementHtml(company)}</h1>
        <p>${escapeSettlementHtml(tagline)}</p>
      </div>
      <span class="code">${escapeSettlementHtml(input.maneuverCode)}</span>
    </header>
    <div class="banner">
      <div>Estado: <strong>${escapeSettlementHtml(input.statusLabel)}</strong></div>
      <div>Cobro: <strong>${escapeSettlementHtml(input.paymentStatusLabel)}</strong></div>
      <div>Completada: <strong>${escapeSettlementHtml(completedAtLabel)}</strong></div>
    </div>
    <section>
      <h3>1. Identificación</h3>
      ${fieldsHtml(input.identification)}
    </section>
    <section>
      <h3>2. Ruta y programación</h3>
      ${fieldsHtml(input.route)}
    </section>
    <section>
      <h3>3. Carga</h3>
      ${fieldsHtml(input.cargo)}
    </section>
    <section>
      <h3>4. Asignación</h3>
      ${
        fieldsHtml(input.assignmentOperator, 'fields fields--3') +
        fieldsHtml(input.assignment) ||
        '<p class="empty">Sin datos registrados.</p>'
      }
    </section>
    </div>
    <div class="sheet-foot">${escapeSettlementHtml(sheetMark)}</div>
  </div>
  <div class="sheet sheet--economics">
    <div class="sheet-body">
    <section>
      <h3>5. Resumen económico</h3>
      <div class="kpis">
        <div class="kpi"><span>Se cobró</span><strong>${escapeSettlementHtml(money(input.charged))}</strong></div>
        <div class="kpi"><span>Se gastó</span><strong>${escapeSettlementHtml(money(input.spent))}</strong></div>
        <div class="kpi${marginClass}"><span>Utilidad</span><strong>${escapeSettlementHtml(money(input.margin))}</strong></div>
        <div class="kpi${marginClass}"><span>Margen</span><strong>${escapeSettlementHtml(marginPct)}</strong></div>
      </div>
    </section>
    <section>
      <h3>6. Cobro al cliente</h3>
      ${fieldsHtml(input.billing)}
    </section>
    <section>
      <h3>7. Costos y gastos</h3>
      ${expensesHtml(input.expenses)}
      <div class="totals">Total gastado: ${escapeSettlementHtml(money(input.spent))}</div>
    </section>
    </div>
    <div class="sheet-foot">${escapeSettlementHtml(sheetMark)}</div>
  </div>
</body>
</html>`;
}

export function buildManiobraSettlementDocument(
  input: ManiobraSettlementDocumentInput,
): ManiobraSettlementDocument {
  return {
    fileTitle: settlementDocumentFileTitle(input.maneuverCode, input.generatedAt),
    html: renderManiobraSettlementDocumentHtml(input),
  };
}

function waitForDocumentImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) {
    return Promise.resolve();
  }
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

export async function printManiobraSettlementDocument(
  documentHtml: string,
  _fileTitle: string,
): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('No hay documento para imprimir.');
  }
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const idoc = iframe.contentDocument;
  if (!win || !idoc) {
    iframe.remove();
    throw new Error('No se pudo preparar el documento de liquidación.');
  }

  idoc.open();
  idoc.write(documentHtml);
  idoc.close();
  idoc.title = '\u200B';
  const previousTitle = document.title;
  document.title = '\u200B';

  try {
    await waitForDocumentImages(idoc);
    win.focus();
    win.print();
  } finally {
    document.title = previousTitle;
  }

  const remove = (): void => iframe.remove();
  win.addEventListener('afterprint', remove, { once: true });
  window.setTimeout(remove, 120_000);
}
