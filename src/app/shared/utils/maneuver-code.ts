/** Palabras que no aportan letra al acrónimo (razón social). */
const STOP_WORDS = new Set([
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'y',
  'en',
]);

/**
 * Iniciales operativas a partir del nombre del cliente (palabras, guiones y «de» ignorado).
 */
export function initialsFromClientName(name: string): string {
  const raw = name.normalize('NFD').replace(/\p{M}/gu, '').trim();
  if (!raw) {
    return 'GN';
  }

  const tokens = raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t.toLowerCase()));

  if (tokens.length === 0) {
    return 'GN';
  }

  const multiWord = tokens.length > 1;

  if (!multiWord) {
    const t = tokens[0];
    const parts = t.split('-').filter((p) => /[A-Za-zÀ-ÿ]/.test(p));
    if (parts.length >= 2) {
      const a = parts[0].match(/[A-Za-zÀ-ÿ]/i)?.[0] ?? '';
      const b = parts[parts.length - 1].match(/[A-Za-zÀ-ÿ]/i)?.[0] ?? '';
      const pair = (a + b).toUpperCase();
      return pair || 'GN';
    }
    const letters = t.match(/[A-Za-zÀ-ÿ]/gi) ?? [];
    if (letters.length >= 2) {
      return (letters[0] + letters[1]).toUpperCase();
    }
    return ((letters[0] ?? 'G') + 'N').toUpperCase();
  }

  const initials = tokens
    .slice(0, 4)
    .map((tok) => {
      const parts = tok.split('-').filter((p) => /[A-Za-zÀ-ÿ]/.test(p));
      if (parts.length >= 2 && tok.includes('-')) {
        return parts[0].match(/[A-Za-zÀ-ÿ]/i)?.[0]?.toUpperCase() ?? '';
      }
      return tok.match(/[A-Za-zÀ-ÿ]/i)?.[0]?.toUpperCase() ?? '';
    })
    .join('');

  return (initials || 'GN').slice(0, 4);
}

/** Extrae el número final de un código tipo `FL-24103` o legado `VX-24103`. */
export function parseManeuverSequenceSuffix(code: string): number {
  const m = code.trim().match(/-(\d+)$/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

export function buildManeuverCode(initials: string, sequence: number): string {
  const prefix = (initials || 'GN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'GN';
  return `${prefix}-${sequence}`;
}
