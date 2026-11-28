import { jsPDF } from 'jspdf';
import { formatMxn } from '@features/reports/utils/reports-money';
import { DESTINATION_RATE_DEFAULT_AXLE_COUNT } from '@features/clients/utils/destination-rate-axle-count.util';
import {
  normalizeDestinationRateScope,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';

/** Origen comercial por defecto cuando la tarifa no trae origen legible. */
export const DESTINATION_RATE_QUOTATION_DEFAULT_ORIGIN = 'Manzanillo, Colima';

/**
 * Paleta neutra corporativa (válida para cualquier empresa).
 * Evita azul/rojo de marca fija en el membrete y paneles.
 */
export const QUOTATION_PDF_BRAND = {
  /** Acento / tipografía de sección (slate-700). */
  accent: [51, 65, 85] as const,
  /** Texto principal (slate-800). */
  ink: [30, 41, 59] as const,
  /** Texto secundario (slate-500). */
  muted: [100, 116, 139] as const,
  /** Líneas de membrete / separadores (slate-400). */
  rule: [148, 163, 184] as const,
  /** Bordes suaves de tabla (slate-300). */
  line: [203, 213, 225] as const,
  /** Fondo de panel (slate-50). */
  panel: [248, 250, 252] as const,
  /** Encabezados de tabla (slate-700). */
  header: [51, 65, 85] as const,
};

const BRAND = QUOTATION_PDF_BRAND;

/** Tipografía corporativa limpia (Helvetica) para documentos PDF. */
const PDF_FONT = 'helvetica';

export const PDF_PRICES_EXCLUDE_IVA_NOTE =
  'Los precios mostrados son más IVA. Al facturar se adiciona el IVA vigente.';

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

async function measureImageSize(
  dataUrl: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        resolve(null);
        return;
      }
      resolve({ width, height });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Membrete centrado: logo en proporción original (sin recortes) o nombre.
 * Con logo (wordmark) no se duplica nombre ni leyenda debajo.
 */
export async function drawQuotationLetterhead(
  doc: jsPDF,
  company: QuotationCompanyBranding,
  marginX: number,
  pageW: number,
  startY: number,
): Promise<number> {
  let y = startY;
  const logo = company.logoDataUrl?.trim() || '';
  const format = logo ? detectImageFormat(logo) : null;
  const name = company.name.trim() || 'Empresa';
  const tagline = company.tagline?.trim() || '';
  const contentW = pageW - marginX * 2;

  let logoDrawn = false;
  if (logo && format) {
    const size = await measureImageSize(logo);
    if (size) {
      const maxW = Math.min(64, contentW * 0.5);
      const maxH = 20;
      const scale = Math.min(maxW / size.width, maxH / size.height, 1);
      const logoW = Math.max(18, size.width * scale);
      const logoH = Math.max(10, size.height * scale);
      const logoX = (pageW - logoW) / 2;
      try {
        doc.addImage(logo, format, logoX, y, logoW, logoH);
        y += logoH + 4;
        logoDrawn = true;
      } catch {
        logoDrawn = false;
      }
    }
  }

  if (!logoDrawn) {
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(15);
    doc.setTextColor(BRAND.ink[0], BRAND.ink[1], BRAND.ink[2]);
    doc.text(name, pageW / 2, y + 5, { align: 'center' });
    y += 9;
    if (tagline) {
      doc.setFont(PDF_FONT, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(BRAND.muted[0], BRAND.muted[1], BRAND.muted[2]);
      const tagLines = doc.splitTextToSize(tagline, contentW) as string[];
      doc.text(tagLines, pageW / 2, y, { align: 'center' });
      y += tagLines.length * 3.8 + 2;
    }
  }

  doc.setDrawColor(BRAND.rule[0], BRAND.rule[1], BRAND.rule[2]);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageW - marginX, y);
  return y + 6;
}

/** Título + fecha centrados bajo el membrete. */
export function drawPdfDocumentHeading(
  doc: jsPDF,
  params: {
    title: string;
    dateLabel: string;
    pageW: number;
    startY: number;
    marginX?: number;
  },
): number {
  let y = params.startY;
  const marginX = params.marginX ?? 14;
  const maxW = params.pageW - marginX * 2;
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(BRAND.ink[0], BRAND.ink[1], BRAND.ink[2]);
  const titleLines = doc.splitTextToSize(params.title, maxW) as string[];
  doc.text(titleLines, params.pageW / 2, y, { align: 'center' });
  y += titleLines.length * 5 + 1.5;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND.muted[0], BRAND.muted[1], BRAND.muted[2]);
  doc.text(`Fecha: ${params.dateLabel}`, params.pageW / 2, y, {
    align: 'center',
  });
  return y + 5.5;
}

/** Leyenda IVA pegada bajo la tabla / bloque de tarifas. */
export function drawPricesExcludeIvaNote(
  doc: jsPDF,
  marginX: number,
  contentW: number,
  y: number,
): number {
  doc.setDrawColor(BRAND.line[0], BRAND.line[1], BRAND.line[2]);
  doc.setLineWidth(0.25);
  doc.line(marginX, y, marginX + contentW, y);

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND.muted[0], BRAND.muted[1], BRAND.muted[2]);
  doc.text(PDF_PRICES_EXCLUDE_IVA_NOTE, marginX, y + 4.2);
  return y + 7.5;
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
  const lineCount = 1 + (email ? 1 : 0) + (phone ? 1 : 0);
  const blockH = 5 + lineCount * 3.8;
  const top = Math.max(afterY + 6, pageH - blockH - 10);

  doc.setDrawColor(BRAND.rule[0], BRAND.rule[1], BRAND.rule[2]);
  doc.setLineWidth(0.35);
  doc.line(marginX, top, pageW - marginX, top);

  let y = top + 5;
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(BRAND.ink[0], BRAND.ink[1], BRAND.ink[2]);
  doc.text(name, pageW / 2, y, { align: 'center' });
  y += 3.8;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(BRAND.muted[0], BRAND.muted[1], BRAND.muted[2]);
  if (email) {
    doc.text(email, pageW / 2, y, { align: 'center' });
    y += 3.5;
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
  let y = await drawQuotationLetterhead(doc, input.company, marginX, pageW, 12);
  const dateLabel = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  y = drawPdfDocumentHeading(doc, {
    title: 'COTIZACIÓN DE SERVICIO DE TRANSPORTE TERRESTRE',
    dateLabel,
    pageW,
    startY: y,
  });

  const panelTop = y;
  const panelPadX = 6;
  const panelPadY = 5;
  const lineStep = 7.2;
  const extraRouteLines = 1 + (input.destinationLabel ? 1 : 0);
  const serviceLineCount = 3 + extraRouteLines;
  const panelH = panelPadY * 2 + 7 + serviceLineCount * lineStep + 2;

  doc.setFillColor(BRAND.panel[0], BRAND.panel[1], BRAND.panel[2]);
  doc.setDrawColor(BRAND.rule[0], BRAND.rule[1], BRAND.rule[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, panelTop, contentW, panelH, 1.5, 1.5, 'FD');
  doc.setFillColor(BRAND.accent[0], BRAND.accent[1], BRAND.accent[2]);
  doc.rect(marginX, panelTop, 1.8, panelH, 'F');

  y = panelTop + panelPadY + 4.5;
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(BRAND.accent[0], BRAND.accent[1], BRAND.accent[2]);
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
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(BRAND.ink[0], BRAND.ink[1], BRAND.ink[2]);
    const bulletLabel = `•  ${line.label}`;
    doc.text(bulletLabel, marginX + panelPadX, y);
    const labelW = doc.getTextWidth(`${bulletLabel} `);
    doc.setFont(PDF_FONT, line.emphasize ? 'bold' : 'normal');
    if (line.emphasize) {
      doc.setTextColor(BRAND.accent[0], BRAND.accent[1], BRAND.accent[2]);
      doc.setFontSize(12);
    } else {
      doc.setTextColor(BRAND.ink[0], BRAND.ink[1], BRAND.ink[2]);
      doc.setFontSize(10.5);
    }
    const valueMaxW = contentW - panelPadX * 2 - labelW;
    const valueLines = doc.splitTextToSize(line.value, valueMaxW) as string[];
    doc.text(valueLines, marginX + panelPadX + labelW, y);
    y += Math.max(lineStep, valueLines.length * 5.2);
  }

  y = panelTop + panelH + 1;
  y = drawPricesExcludeIvaNote(doc, marginX, contentW, y);
  y += 4;

  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.accent[0], BRAND.accent[1], BRAND.accent[2]);
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
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(titleSize);
    doc.setTextColor(BRAND.ink[0], BRAND.ink[1], BRAND.ink[2]);
    doc.text(section.title, marginX, y);
    y += bodyLh + 0.4;

    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(bodySize);
    doc.setTextColor(BRAND.muted[0], BRAND.muted[1], BRAND.muted[2]);
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
  doc.setDrawColor(BRAND.rule[0], BRAND.rule[1], BRAND.rule[2]);
  doc.setLineWidth(0.45);
  doc.line(marginX, footerY - 3, pageW - marginX, footerY - 3);

  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND.ink[0], BRAND.ink[1], BRAND.ink[2]);
  y = drawWrappedText(
    doc,
    'Vigencia: sujeta a confirmación al momento de contratar el servicio.',
    marginX,
    footerY,
    contentW,
    3.1,
  );
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(BRAND.muted[0], BRAND.muted[1], BRAND.muted[2]);
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
