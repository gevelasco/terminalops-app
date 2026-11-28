import { jsPDF } from 'jspdf';
import { formatMxn } from '@features/reports/utils/reports-money';
import { DESTINATION_RATE_DEFAULT_AXLE_COUNT } from '@features/clients/utils/destination-rate-axle-count.util';
import {
  normalizeDestinationRateScope,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';

/** Origen comercial por defecto cuando la tarifa no trae origen legible. */
export const DESTINATION_RATE_QUOTATION_DEFAULT_ORIGIN = 'Manzanillo, Colima';

/** Paleta compartida con catálogo de tarifas PDF. */
export const QUOTATION_PDF_BRAND = {
  navy: [26, 58, 107] as const,
  red: [200, 16, 46] as const,
  ink: [31, 41, 51] as const,
  muted: [75, 85, 99] as const,
  line: [209, 213, 219] as const,
  panel: [245, 248, 252] as const,
};

const BRAND = QUOTATION_PDF_BRAND;

export type QuotationCompanyBranding = {
  name: string;
  tagline?: string | null;
  logoDataUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export type DestinationRateQuotationInput = {
  serviceType: string;
  axleConfiguration: string;
  commercialRate: number;
  destinationLabel?: string;
  originLabel: string;
  company: QuotationCompanyBranding;
};

function formatQuotationMxn(amount: number): string {
  const formatted = formatMxn(amount, true);
  return /MXN/i.test(formatted) ? formatted : `${formatted} MXN`;
}

function axleConfigurationLabel(axleCount: number | null | undefined): string {
  const raw =
    axleCount != null && Number.isFinite(axleCount) && axleCount > 0
      ? Math.round(axleCount)
      : DESTINATION_RATE_DEFAULT_AXLE_COUNT;
  const n = Math.min(12, Math.max(2, raw));
  return `${n} eje${n === 1 ? '' : 's'}`;
}

export function resolveQuotationOriginLabel(params?: {
  originCityMunicipality?: string | null;
  originLocality?: string | null;
}): string {
  const city = (params?.originCityMunicipality ?? '').trim();
  const locality = (params?.originLocality ?? '').trim();
  if (city.includes(',')) {
    return city;
  }
  if (locality && city) {
    return `${locality}, ${city}`;
  }
  if (city) {
    return city;
  }
  if (locality) {
    return locality;
  }
  return DESTINATION_RATE_QUOTATION_DEFAULT_ORIGIN;
}

/**
 * Destino según política de tarifas:
 * - state: solo estado
 * - municipality: municipio, estado
 * - postal_code: municipio/colonia, estado + CP
 */
export function resolveQuotationDestinationLabel(params: {
  scope?: DestinationRateScope | string | null;
  state?: string | null;
  municipality?: string | null;
  postalCode?: string | null;
  locality?: string | null;
}): string | undefined {
  const scope = normalizeDestinationRateScope(params.scope);
  const state = (params.state ?? '').trim();
  const municipality = (params.municipality ?? '').trim();
  const postalCode = (params.postalCode ?? '').trim();
  const locality = (params.locality ?? '').trim();
  const clean = (value: string) => (value && value !== '—' ? value : '');

  const stateClean = clean(state);
  const muniClean = clean(municipality);
  const cpClean = clean(postalCode);
  const locClean = clean(locality);

  if (scope === 'state') {
    return stateClean || undefined;
  }

  if (scope === 'municipality') {
    if (muniClean && stateClean) {
      return `${muniClean}, ${stateClean}`;
    }
    return muniClean || stateClean || undefined;
  }

  const placeParts = [locClean || muniClean, stateClean].filter(Boolean);
  const place = placeParts.join(', ');
  if (place && cpClean) {
    return `${place} (CP ${cpClean})`;
  }
  if (place) {
    return place;
  }
  return cpClean ? `CP ${cpClean}` : undefined;
}

export function buildQuotationCompanyBranding(
  company: QuotationCompanyBranding,
): QuotationCompanyBranding {
  return {
    name: company.name.trim() || 'Empresa',
    tagline: company.tagline?.trim() || null,
    logoDataUrl: company.logoDataUrl?.trim() || null,
    contactEmail: company.contactEmail?.trim() || null,
    contactPhone: company.contactPhone?.trim() || null,
  };
}

/** Branding PDF desde SessionService (nombre, logo y contacto comercial). */
export function quotationBrandingFromSession(session: {
  companyName: () => string | null;
  companyTagline: () => string | null;
  companyLogoDataUrl: () => string | null;
  companyContactEmail: () => string | null;
  companyContactPhone: () => string | null;
}): QuotationCompanyBranding {
  return buildQuotationCompanyBranding({
    name: session.companyName() || 'Empresa',
    tagline: session.companyTagline(),
    logoDataUrl: session.companyLogoDataUrl(),
    contactEmail: session.companyContactEmail(),
    contactPhone: session.companyContactPhone(),
  });
}

export function buildDestinationRateQuotationInput(params: {
  serviceType: string;
  axleCount?: number | null;
  commercialRate: number;
  destinationLabel?: string;
  originLabel?: string;
  company: QuotationCompanyBranding;
}): DestinationRateQuotationInput {
  return {
    serviceType: params.serviceType.trim() || '—',
    axleConfiguration: axleConfigurationLabel(params.axleCount),
    commercialRate: params.commercialRate,
    destinationLabel: params.destinationLabel?.trim() || undefined,
    originLabel:
      params.originLabel?.trim() || DESTINATION_RATE_QUOTATION_DEFAULT_ORIGIN,
    company: buildQuotationCompanyBranding(params.company),
  };
}

function detectImageFormat(
  dataUrl: string,
): 'PNG' | 'JPEG' | 'WEBP' | null {
  if (dataUrl.startsWith('data:image/png')) {
    return 'PNG';
  }
  if (
    dataUrl.startsWith('data:image/jpeg') ||
    dataUrl.startsWith('data:image/jpg')
  ) {
    return 'JPEG';
  }
  if (dataUrl.startsWith('data:image/webp')) {
    return 'WEBP';
  }
  return null;
}

function drawWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function drawQuotationLetterhead(
  doc: jsPDF,
  company: QuotationCompanyBranding,
  marginX: number,
  pageW: number,
  startY: number,
): number {
  let y = startY;
  const logo = company.logoDataUrl?.trim() || '';
  const format = logo ? detectImageFormat(logo) : null;
  const name = company.name.trim() || 'Empresa';
  const tagline = company.tagline?.trim() || '';

  const textLeft = marginX + (format ? 28 : 0);

  if (logo && format) {
    try {
      const logoSize = 18;
      doc.addImage(logo, format, marginX, y, logoSize, logoSize);
    } catch {
      // Data URL inválido: solo tipografía.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...BRAND.navy);
  doc.text(name, textLeft, y + 7);

  if (tagline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.muted);
    const tagLines = doc.splitTextToSize(tagline, pageW - textLeft - marginX) as string[];
    doc.text(tagLines, textLeft, y + 12.5);
    y += Math.max(20, 14 + tagLines.length * 3.6);
  } else {
    y += 20;
  }

  doc.setDrawColor(...BRAND.red);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageW - marginX, y);
  return y + 7;
}

export function drawQuotationContactFooter(
  doc: jsPDF,
  company: QuotationCompanyBranding,
  marginX: number,
  pageW: number,
  pageH: number,
  afterY: number,
): void {
  const name = company.name.trim() || 'Empresa';
  const email = company.contactEmail?.trim() || '';
  const phone = company.contactPhone?.trim() || '';
  const lines = [name, email, phone].filter(Boolean);
  const blockH = 6 + lines.length * 4.2;
  const top = Math.max(afterY + 4, pageH - blockH - 8);

  doc.setDrawColor(...BRAND.navy);
  doc.setLineWidth(0.35);
  doc.line(marginX, top, pageW - marginX, top);

  doc.setFillColor(...BRAND.panel);
  doc.rect(marginX, top + 1.2, pageW - marginX * 2, blockH - 1, 'F');

  let y = top + 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.navy);
  doc.text(name, pageW / 2, y, { align: 'center' });
  y += 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...BRAND.muted);
  if (email) {
    doc.text(email, pageW / 2, y, { align: 'center' });
    y += 3.8;
  }
  if (phone) {
    doc.text(phone, pageW / 2, y, { align: 'center' });
  }
}

/**
 * Cotización de transporte terrestre en una sola hoja (carta),
 * membrete y pie con branding de la empresa.
 */
export async function downloadDestinationRateQuotationPdf(
  input: DestinationRateQuotationInput,
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  let y = drawQuotationLetterhead(doc, input.company, marginX, pageW, 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BRAND.ink);
  const title = 'COTIZACIÓN DE SERVICIO DE TRANSPORTE TERRESTRE';
  const titleLines = doc.splitTextToSize(title, contentW) as string[];
  doc.text(titleLines, pageW / 2, y, { align: 'center' });
  y += titleLines.length * 5.4 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(
    `Fecha: ${new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })}`,
    pageW / 2,
    y,
    { align: 'center' },
  );
  y += 7;

  const panelTop = y;
  const panelPadX = 6;
  const panelPadY = 5;
  const lineStep = 7.2;
  const extraRouteLines = 1 + (input.destinationLabel ? 1 : 0);
  const serviceLineCount = 3 + extraRouteLines;
  const noteH = 8;
  const panelH = panelPadY * 2 + 7 + serviceLineCount * lineStep + noteH;

  doc.setFillColor(...BRAND.panel);
  doc.setDrawColor(...BRAND.navy);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, panelTop, contentW, panelH, 1.5, 1.5, 'FD');
  doc.setFillColor(...BRAND.navy);
  doc.rect(marginX, panelTop, 1.8, panelH, 'F');

  y = panelTop + panelPadY + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.navy);
  doc.text('Descripción del servicio', marginX + panelPadX, y);
  y += 8;

  const rateLabel = formatQuotationMxn(input.commercialRate);
  const serviceLines: Array<{
    label: string;
    value: string;
    emphasize?: boolean;
  }> = [
    { label: 'Origen:', value: input.originLabel },
    ...(input.destinationLabel
      ? [{ label: 'Destino:', value: input.destinationLabel }]
      : []),
    { label: 'Tipo de servicio:', value: input.serviceType },
    { label: 'Configuración vehicular:', value: input.axleConfiguration },
    { label: 'Tarifa comercial:', value: rateLabel, emphasize: true },
  ];

  for (const line of serviceLines) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...BRAND.ink);
    const bulletLabel = `•  ${line.label}`;
    doc.text(bulletLabel, marginX + panelPadX, y);
    const labelW = doc.getTextWidth(`${bulletLabel} `);
    doc.setFont('helvetica', line.emphasize ? 'bold' : 'normal');
    if (line.emphasize) {
      doc.setTextColor(...BRAND.navy);
      doc.setFontSize(12);
    } else {
      doc.setTextColor(...BRAND.ink);
      doc.setFontSize(10.5);
    }
    const valueMaxW = contentW - panelPadX * 2 - labelW;
    const valueLines = doc.splitTextToSize(line.value, valueMaxW) as string[];
    doc.text(valueLines, marginX + panelPadX + labelW, y);
    y += Math.max(lineStep, valueLines.length * 5.2);
  }

  y += 1;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  drawWrappedText(
    doc,
    'La tarifa indicada corresponde al servicio de transporte cotizado y no incluye IVA.',
    marginX + panelPadX,
    y,
    contentW - panelPadX * 2,
    3.8,
  );
  y = panelTop + panelH + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.navy);
  doc.text('CONDICIONES GENERALES DEL SERVICIO', marginX, y);
  y += 6;

  const conditions: Array<{ title: string; body: string }> = [
    {
      title: '1. Peso y dimensiones',
      body: `Límite comercial de 24 t de peso bruto del contenedor (tara + mercancía). Excedente: ${formatQuotationMxn(1500)} por tonelada, sujeto a NOM-012-SCT-2-2017 y a la ruta autorizada. El cliente debe declarar peso y dimensiones reales.`,
    },
    {
      title: '2. Pago y facturación',
      body: 'Tarifa antes de IVA. Si se requiere factura, se adiciona el IVA vigente. Plazos de pago por acuerdo entre las partes.',
    },
    {
      title: '3. Seguro',
      body: 'El seguro de mercancía y contenedor es responsabilidad del cliente, salvo aseguramiento adicional pactado expresamente.',
    },
    {
      title: '4. Maniobras',
      body: 'No incluye carga ni descarga. Servicios adicionales se cotizan y autorizan por separado.',
    },
    {
      title: '5. Estadías',
      body: `Hasta 24 h libres desde el arribo. Después: ${formatQuotationMxn(3500)} por día y contenedor.`,
    },
    {
      title: '6. Responsabilidad y extras',
      body: 'El cliente entrega documentación y garantiza carga legal. Cualquier servicio o cambio no incluido debe autorizarse y cotizarse antes.',
    },
  ];

  const footerReserve = 34;
  const available = pageH - footerReserve - y;
  doc.setFontSize(8.2);
  let rawLines = 0;
  for (const section of conditions) {
    rawLines += 1;
    rawLines += (doc.splitTextToSize(section.body, contentW - 2) as string[])
      .length;
  }
  let bodyLh = available / Math.max(rawLines + conditions.length * 0.8, 1);
  bodyLh = Math.min(4.0, Math.max(3.1, bodyLh));
  const bodySize = bodyLh >= 3.6 ? 8.4 : 7.8;
  const titleSize = bodySize + 0.9;

  for (const section of conditions) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(titleSize);
    doc.setTextColor(...BRAND.ink);
    doc.text(section.title, marginX, y);
    y += bodyLh + 0.4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(bodySize);
    doc.setTextColor(...BRAND.muted);
    const lines = doc.splitTextToSize(section.body, contentW) as string[];
    doc.text(lines, marginX, y);
    y += lines.length * bodyLh + 2.2;
  }

  const contactBlockH = 16;
  const vigenciaBlockH = 10;
  const footerY = Math.min(
    Math.max(y + 3, pageH - contactBlockH - vigenciaBlockH - 4),
    pageH - contactBlockH - vigenciaBlockH,
  );
  doc.setDrawColor(...BRAND.red);
  doc.setLineWidth(0.45);
  doc.line(marginX, footerY - 3, pageW - marginX, footerY - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.ink);
  y = drawWrappedText(
    doc,
    'Vigencia: sujeta a confirmación al momento de contratar el servicio.',
    marginX,
    footerY,
    contentW,
    3.1,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.muted);
  y = drawWrappedText(
    doc,
    'La contratación implica la aceptación de estas condiciones comerciales y operativas.',
    marginX,
    y + 0.5,
    contentW,
    3.0,
  );

  drawQuotationContactFooter(doc, input.company, marginX, pageW, pageH, y);

  const safeService =
    input.serviceType
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\w]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32) || 'servicio';
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`cotizacion_${safeService}_${stamp}.pdf`);
}
