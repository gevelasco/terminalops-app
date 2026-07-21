import type { MxPostalSettlement } from '@shared/services/mexico-postal-code.service';

/** CP mexicano: solo dígitos, máximo 5. */
export function normalizeMxPostalCodeDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 5);
}

/** Clave estable para filas SEPOMex (select / búsqueda por localidad). */
export function localityKey(s: MxPostalSettlement): string {
  if (s.settlementConsId) {
    return s.settlementConsId;
  }
  return `${s.postalCode}|${s.settlement}|${s.municipality}`;
}

/** Etiqueta de opción: tipo de asentamiento + nombre. */
export function formatSettlementOptionLabel(s: MxPostalSettlement): string {
  const t = s.settlementType.trim();
  const n = s.settlement;
  return t ? `${t} ${n}` : n;
}

/** Línea de ciudad/municipio + estado (solo lectura en formulario / snapshot). */
export function cityMunicipalityLineFromSettlement(s: MxPostalSettlement): string {
  if (s.city) {
    return `${s.city}, ${s.state}`;
  }
  return `${s.municipality}, ${s.state}`;
}

/** Texto de ruta legible a partir de asentamiento SEPOMex (formulario). */
export function formatLocationLabelFromSettlement(
  s: MxPostalSettlement,
  cpDigits: string,
): string {
  const parts = [s.settlement, s.city || s.municipality, s.state, 'México'].filter(
    (p) => !!p && p.trim() !== '',
  );
  return `${parts.join(', ')} (CP ${cpDigits})`;
}

/** Cadena enviada a Photon para geocodificar un asentamiento SEPOMex. */
export function geocodeQueryFromSettlement(s: MxPostalSettlement, cpDigits: string): string {
  const city = (s.city || '').trim();
  const muni = s.municipality.trim();
  const parts: string[] = [s.settlement.trim(), muni];
  const cityLc = city.toLowerCase();
  const muniLc = muni.toLowerCase();
  if (
    city &&
    cityLc !== muniLc &&
    !cityLc.includes(muniLc) &&
    !muniLc.includes(cityLc)
  ) {
    parts.push(city);
  }
  parts.push(s.state.trim(), 'México', `CP ${cpDigits}`);
  return parts.join(', ');
}
