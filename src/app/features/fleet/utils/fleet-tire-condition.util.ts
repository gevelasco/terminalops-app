import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/** Resuelve value del catálogo desde lo guardado (label o value legacy). */
export function fleetTireConditionValueFromStored(
  stored: string | undefined,
  options: readonly ToSelectOption[],
): string {
  const t = stored?.trim() ?? '';
  if (!t) {
    return '';
  }
  if (options.some((o) => o.value === t)) {
    return t;
  }
  return options.find((o) => o.label === t)?.value ?? '';
}

export function fleetTireConditionLabelForValue(
  value: string,
  options: readonly ToSelectOption[],
): string {
  const v = value.trim();
  if (!v) {
    return '';
  }
  return options.find((o) => o.value === v)?.label ?? v;
}

export function fleetTireConditionDisplayLabel(
  stored: string | undefined,
  options: readonly ToSelectOption[],
): string {
  const t = stored?.trim() ?? '';
  if (!t) {
    return '—';
  }
  const byLabel = options.find((o) => o.label === t);
  if (byLabel) {
    return byLabel.label;
  }
  const byValue = options.find((o) => o.value === t);
  if (byValue) {
    return byValue.label;
  }
  return t;
}
