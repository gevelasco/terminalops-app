export const DESTINATION_RATE_DEFAULT_AXLE_COUNT = 5;

export function parseDestinationRateAxleCount(raw: string | undefined): number {
  const t = (raw ?? '').trim();
  const n = t === '' ? DESTINATION_RATE_DEFAULT_AXLE_COUNT : Number(t);
  if (!Number.isFinite(n)) {
    return DESTINATION_RATE_DEFAULT_AXLE_COUNT;
  }
  const rounded = Math.round(n);
  if (rounded < 2) {
    return 2;
  }
  if (rounded > 12) {
    return 12;
  }
  return rounded;
}