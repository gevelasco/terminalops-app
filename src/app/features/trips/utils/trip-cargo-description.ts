export function tripCargoDescriptionDisplay(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '—';
}
