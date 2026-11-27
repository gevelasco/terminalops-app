import { jsPDF } from 'jspdf';
import { formatMxn } from '@features/reports/utils/reports-money';
import { DESTINATION_RATE_DEFAULT_AXLE_COUNT } from '@features/clients/utils/destination-rate-axle-count.util';
import {
  normalizeDestinationRateScope,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';

const LOGO_URL = '/branding/vsc-grupo-logistico.jpg';

/** Origen comercial por defecto (base operativa VSC). */
export const DESTINATION_RATE_QUOTATION_DEFAULT_ORIGIN = 'Manzanillo, Colima';

const COMPANY_CONTACT = {
  name: 'Grupo Logístico VSC',
  email: 'contacto.grupovsc@gmail.com',
  phone: '+52 3121675278',
} as const;

const BRAND = {
  navy: [26, 58, 107] as const,
  red: [200, 16, 46] as const,
  ink: [31, 41, 51] as const,
  muted: [75, 85, 99] as const,
  line: [209, 213, 219] as const,
  panel: [245, 248, 252] as const,
};

export type DestinationRateQuotationInput = {
  serviceType: string;
  axleConfiguration: string;
  commercialRate: number;
  destinationLabel?: string;
  originLabel: string;
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

  // postal_code
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

export function buildDestinationRateQuotationInput(params: {
  serviceType: string;
  axleCount?: number | null;
  commercialRate: number;
  destinationLabel?: string;
  originLabel?: string;
}): DestinationRateQuotationInput {
  return {
    serviceType: params.serviceType.trim() || '—',
    axleConfiguration: axleConfigurationLabel(params.axleCount),
    commercialRate: params.commercialRate,
    destinationLabel: params.destinationLabel?.trim() || undefined,
    originLabel:
      params.originLabel?.trim() || DESTINATION_RATE_QUOTATION_DEFAULT_ORIGIN,
  };
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) {
      return null;
    }
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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

/**
 * Cotización de transporte terrestre en una sola hoja (carta), con membrete VSC.
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
  let y = 12;

  const logo = await loadLogoDataUrl();
  if (logo) {
    const logoW = 64;
    const logoH = (logoW * 244) / 888;
    doc.addImage(logo, 'JPEG', marginX, y, logoW, logoH);
    y += logoH + 2.5;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BRAND.navy);
    doc.text('VSC Grupo Logístico', marginX, y + 6);
    y += 14;
  }

  doc.setDrawColor(...BRAND.red);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageW - marginX, y);
  y += 8;

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

  // Panel protagonista: descripción del servicio
  const panelTop = y;
  const panelPadX = 6;
  const panelPadY = 5;
  const lineStep = 7.2;
  const extraRouteLines = 1 + (input.destinationLabel ? 1 : 0);
  const serviceLineCount = 3 + extraRouteLines; // tipo, ejes, tarifa + origen/destino
  const noteH = 8;
  const panelH =
    panelPadY * 2 + 7 + serviceLineCount * lineStep + noteH;

  doc.setFillColor(...BRAND.panel);
  doc.setDrawColor(...BRAND.navy);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, panelTop, contentW, panelH, 1.5, 1.5, 'FD');
  // Acento izquierdo
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

  const footerReserve = 30;
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

  // Vigencia + pie de contacto
  const contactBlockH = 14;
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

  const contactTop = Math.max(y + 4, pageH - contactBlockH);
  doc.setDrawColor(...BRAND.line);
  doc.setLineWidth(0.25);
  doc.line(marginX, contactTop - 2, pageW - marginX, contactTop - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.navy);
  doc.text(COMPANY_CONTACT.name, pageW / 2, contactTop + 2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...BRAND.muted);
  doc.text(COMPANY_CONTACT.email, pageW / 2, contactTop + 5.8, {
    align: 'center',
  });
  doc.text(COMPANY_CONTACT.phone, pageW / 2, contactTop + 9.2, {
    align: 'center',
  });

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
