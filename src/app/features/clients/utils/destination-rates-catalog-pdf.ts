import { jsPDF } from 'jspdf';
import type { DestinationRate } from '@shared/models/destination-rate.models';
import {
  normalizeDestinationRateScope,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';
import {
  buildDestinationRateTableRows,
  type DestinationRateTableRow,
} from '@features/clients/utils/destination-rates-table-rows';
import {
  buildQuotationCompanyBranding,
  drawPdfDocumentHeading,
  drawPricesExcludeIvaNote,
  drawQuotationContactFooter,
  drawQuotationLetterhead,
  QUOTATION_PDF_BRAND,
  type QuotationCompanyBranding,
} from '@features/clients/utils/destination-rate-quotation-pdf';

const BRAND = QUOTATION_PDF_BRAND;
const PDF_FONT = 'helvetica';

type CatalogColumn = {
  key: 'state' | 'municipality' | 'postalCode' | 'maneuver' | 'cost' | 'eta';
  header: string;
  weight: number;
  align: 'left' | 'right' | 'center';
};

function catalogColumns(scope: DestinationRateScope): CatalogColumn[] {
  if (scope === 'state') {
    return [
      { key: 'state', header: 'Estado', weight: 2.4, align: 'left' },
      { key: 'maneuver', header: 'Maniobra', weight: 2.6, align: 'left' },
      { key: 'cost', header: 'Cobro Cliente', weight: 1.8, align: 'right' },
      { key: 'eta', header: 'ETA', weight: 1.2, align: 'center' },
    ];
  }
  if (scope === 'municipality') {
    return [
      { key: 'state', header: 'Estado', weight: 2.0, align: 'left' },
      { key: 'municipality', header: 'Municipio', weight: 2.2, align: 'left' },
      { key: 'maneuver', header: 'Maniobra', weight: 2.2, align: 'left' },
      { key: 'cost', header: 'Cobro Cliente', weight: 1.7, align: 'right' },
      { key: 'eta', header: 'ETA', weight: 1.1, align: 'center' },
    ];
  }
  return [
    { key: 'state', header: 'Estado', weight: 1.8, align: 'left' },
    { key: 'municipality', header: 'Municipio', weight: 1.9, align: 'left' },
    { key: 'postalCode', header: 'CP', weight: 0.9, align: 'center' },
    { key: 'maneuver', header: 'Maniobra', weight: 2.0, align: 'left' },
    { key: 'cost', header: 'Cobro Cliente', weight: 1.6, align: 'right' },
    { key: 'eta', header: 'ETA', weight: 1.0, align: 'center' },
  ];
}

function cellText(
  row: DestinationRateTableRow,
  key: CatalogColumn['key'],
): string {
  switch (key) {
    case 'state':
      return row.stateRowSpan > 0 ? row.state || '—' : '';
    case 'municipality':
      return row.municipalityRowSpan > 0 ? row.municipality || '—' : '';
    case 'postalCode':
      return row.postalCodeRowSpan > 0 ? row.postalCode || '—' : '';
    case 'maneuver':
      return row.maneuver || '—';
    case 'cost':
      return row.costLabel || '—';
    case 'eta':
      return row.etaLabel || '—';
  }
}

function layoutColumnWidths(
  columns: readonly CatalogColumn[],
  contentW: number,
): number[] {
  const total = columns.reduce((sum, c) => sum + c.weight, 0);
  return columns.map((c) => (c.weight / total) * contentW);
}

/** Catálogo de tarifas PDF (carta membretada); Estado/Municipio/CP sin repetir. */
export async function downloadDestinationRatesCatalogPdf(params: {
  rates: readonly DestinationRate[];
  stateByRateId?: ReadonlyMap<string, string>;
  scope?: DestinationRateScope | string | null;
  company: QuotationCompanyBranding;
}): Promise<number> {
  const scope = normalizeDestinationRateScope(params.scope);
  const rows = buildDestinationRateTableRows(
    params.rates,
    params.stateByRateId,
    undefined,
    scope,
  );
  if (rows.length === 0) {
    return 0;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentW = pageW - marginX * 2;
  const ivaNoteH = 8;
  const footerReserve = 30 + ivaNoteH;
  const rowH = 6.2;
  const headerH = 7.2;
  const columns = catalogColumns(scope);
  const colWidths = layoutColumnWidths(columns, contentW);
  const company = buildQuotationCompanyBranding(params.company);

  const dateLabel = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  let pageIndex = 0;
  let y = 0;
  let tableBottom = pageH - footerReserve;

  const startPage = async (): Promise<void> => {
    if (pageIndex > 0) {
      doc.addPage();
    }
    pageIndex += 1;
    y = await drawQuotationLetterhead(doc, company, marginX, pageW, 12);
    y = drawPdfDocumentHeading(doc, {
      title: 'CATÁLOGO DE TARIFAS POR DESTINO',
      dateLabel,
      pageW,
      startY: y,
    });

    drawTableHeader(doc, columns, colWidths, marginX, y, headerH);
    y += headerH;
    tableBottom = pageH - footerReserve;
  };

  const closeTableBlock = (): void => {
    y = drawPricesExcludeIvaNote(doc, marginX, contentW, y);
    drawQuotationContactFooter(doc, company, marginX, pageW, pageH, y);
  };

  await startPage();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    if (y + rowH > tableBottom) {
      closeTableBlock();
      await startPage();
    }

    const zebra = i % 2 === 1;
    if (zebra) {
      doc.setFillColor(BRAND.panel[0], BRAND.panel[1], BRAND.panel[2]);
      doc.rect(marginX, y, contentW, rowH, 'F');
    }

    let x = marginX;
    for (let c = 0; c < columns.length; c += 1) {
      const col = columns[c]!;
      const w = colWidths[c]!;
      const raw = cellText(row, col.key);
      const isMergedLead =
        (col.key === 'state' && row.stateRowSpan > 0) ||
        (col.key === 'municipality' && row.municipalityRowSpan > 0) ||
        (col.key === 'postalCode' && row.postalCodeRowSpan > 0);
      const isMergedTail =
        (col.key === 'state' && row.stateRowSpan === 0) ||
        (col.key === 'municipality' && row.municipalityRowSpan === 0) ||
        (col.key === 'postalCode' && row.postalCodeRowSpan === 0);

      doc.setDrawColor(BRAND.line[0], BRAND.line[1], BRAND.line[2]);
      doc.setLineWidth(0.15);
      doc.rect(x, y, w, rowH);

      if (!isMergedTail && raw) {
        doc.setFont(
          PDF_FONT,
          isMergedLead || col.key === 'cost' ? 'bold' : 'normal',
        );
        doc.setFontSize(col.key === 'state' ? 8 : 7.6);
        const ink = isMergedLead ? BRAND.accent : BRAND.ink;
        doc.setTextColor(ink[0], ink[1], ink[2]);
        const pad = 1.4;
        const maxW = w - pad * 2;
        const clipped = doc.splitTextToSize(raw, maxW) as string[];
        const line = (clipped[0] as string) || '';
        const textY = y + rowH / 2 + 1.1;
        if (col.align === 'right') {
          doc.text(line, x + w - pad, textY, { align: 'right' });
        } else if (col.align === 'center') {
          doc.text(line, x + w / 2, textY, { align: 'center' });
        } else {
          doc.text(line, x + pad, textY);
        }
      }
      x += w;
    }
    y += rowH;
  }

  closeTableBlock();

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawPageNumber(doc, p, totalPages, pageW, pageH);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`tarifas_catalogo_${stamp}.pdf`);
  return rows.length;
}

function drawTableHeader(
  doc: jsPDF,
  columns: readonly CatalogColumn[],
  colWidths: readonly number[],
  marginX: number,
  y: number,
  headerH: number,
): void {
  const contentW = colWidths.reduce((a, b) => a + b, 0);
  doc.setFillColor(BRAND.header[0], BRAND.header[1], BRAND.header[2]);
  doc.rect(marginX, y, contentW, headerH, 'F');

  let x = marginX;
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);
  for (let c = 0; c < columns.length; c += 1) {
    const col = columns[c]!;
    const w = colWidths[c]!;
    const pad = 1.4;
    const textY = y + headerH / 2 + 1.15;
    if (col.align === 'right') {
      doc.text(col.header, x + w - pad, textY, { align: 'right' });
    } else if (col.align === 'center') {
      doc.text(col.header, x + w / 2, textY, { align: 'center' });
    } else {
      doc.text(col.header, x + pad, textY);
    }
    x += w;
  }
}

function drawPageNumber(
  doc: jsPDF,
  page: number,
  total: number,
  pageW: number,
  pageH: number,
): void {
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(BRAND.muted[0], BRAND.muted[1], BRAND.muted[2]);
  doc.text(`Página ${page} de ${total}`, pageW / 2, pageH - 5.5, {
    align: 'center',
  });
}
