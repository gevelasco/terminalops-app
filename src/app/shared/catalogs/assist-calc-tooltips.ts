export const ASSIST_CALC_TOOLTIP_AUTO =
  'Control asistido por el sistema. Puedes modificarlo manualmente.';

export const ASSIST_CALC_TOOLTIP_UNAVAILABLE = 'Cálculo asistido no disponible';

export function assistCalcTooltip(isAuto: boolean): string {
  return isAuto ? ASSIST_CALC_TOOLTIP_AUTO : ASSIST_CALC_TOOLTIP_UNAVAILABLE;
}
