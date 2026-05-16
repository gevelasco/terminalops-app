import type { ClientCommercialHealth, ClientContactPerson } from '@shared/models/client.models';

export function parseOptionalInt(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

export function yesNoToBool(v: string): boolean {
  return v === 'yes' || v === 'true' || v === '1';
}

export function boolToYesNo(v: boolean): string {
  return v ? 'yes' : 'no';
}

export function normalizeContacts(list: ClientContactPerson[]): ClientContactPerson[] {
  return list
    .map((c) => ({
      ...c,
      name: c.name.trim(),
      role: c.role?.trim() || undefined,
      phone: c.phone?.trim() || undefined,
      email: c.email?.trim() || undefined,
    }))
    .filter((c) => c.name.length > 0);
}

export function commercialHealthFromUnknown(
  v: string | undefined,
): ClientCommercialHealth {
  if (
    v === 'good_standing' ||
    v === 'watch_list' ||
    v === 'restricted' ||
    v === 'not_evaluated'
  ) {
    return v;
  }
  return 'not_evaluated';
}
