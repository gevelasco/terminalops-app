import type { DestinationRate } from '@shared/models/destination-rate.models';
import {
  suggestedClientChargeFromDestinationRate,
  suggestedEstimatedTollFromDestinationRate,
  suggestedOperatorPaymentFromDestinationRate,
  suggestedPerDiemFromDestinationRate,
} from '@features/clients/utils/find-destination-rate-by-postal-code';
import { formatFuelEstimateMoney } from '@features/trips/utils/trips-fuel-estimate';
import { stripGroupedNumberInput } from '@features/trips/utils/parse-non-negative';

export type DestinationRateSuggestionUi = 'none' | 'auto' | 'manual';

/** Clave del match remoto de tarifa (origen + ruta por scope + tarifa del cliente). */
export function destinationRateMatchKey(
  rateOriginId: string,
  cp: string,
  destLocality: string,
  clientRateId: string,
  municipalityName = '',
  stateName = '',
  scope = 'postal_code',
): string {
  return `${scope}|${rateOriginId}|${cp}|${destLocality}|${municipalityName}|${stateName}|${clientRateId}`;
}

/** Huella de inputs que invalidan el lock de sugerencia monetaria. */
export function destinationRateSuggestionInputFingerprint(
  originId: string,
  cp: string,
  destLocality: string,
  operationType: string,
  includeBilling: boolean,
  municipalityName = '',
  stateName = '',
  scope = 'postal_code',
): string {
  return `${scope}|${originId}|${cp}|${destLocality}|${municipalityName}|${stateName}|${operationType}|${includeBilling ? '1' : '0'}`;
}

/** Huella de contexto que resetea sugerencias de fechas planificadas. */
export function destinationRatePlannedScheduleContextFingerprint(
  originId: string,
  clientId: string,
  cp: string,
  destLocality: string,
  rateId: string,
  municipalityName = '',
  stateName = '',
  scope = 'postal_code',
): string {
  return `${scope}|${originId}|${clientId}|${cp}|${destLocality}|${municipalityName}|${stateName}|${rateId}`;
}

export function autoAssistValueMatches(current: string, lastAuto: string): boolean {
  const cur = stripGroupedNumberInput(current);
  const auto = stripGroupedNumberInput(lastAuto);
  return auto !== '' && cur === auto;
}

export type DestinationRateSuggestionFields = {
  operatorQuota: string | null;
  clientCharge: string | null;
  /** Si billing está off, la UI de cobro debe quedar en `none` (no aplica valor). */
  clientChargeUi: DestinationRateSuggestionUi;
  casetasAmount: string | null;
  perDiemAmount: string | null;
};

/**
 * Calcula montos formateados a sugerir desde la tarifa.
 * No toca ruta/km: eso queda en el componente.
 */
export function computeDestinationRateSuggestionFields(
  rate: DestinationRate,
  operationType: string,
  includeBilling: boolean,
): DestinationRateSuggestionFields {
  const opPay = suggestedOperatorPaymentFromDestinationRate(rate, operationType);
  const toll = suggestedEstimatedTollFromDestinationRate(rate, operationType);
  const perDiem = suggestedPerDiemFromDestinationRate(rate, operationType);

  let clientCharge: string | null = null;
  let clientChargeUi: DestinationRateSuggestionUi = 'none';
  if (includeBilling) {
    const charge = suggestedClientChargeFromDestinationRate(rate, operationType);
    clientCharge = formatFuelEstimateMoney(charge);
    clientChargeUi = 'auto';
  }

  return {
    operatorQuota: opPay != null ? formatFuelEstimateMoney(opPay) : null,
    clientCharge,
    clientChargeUi,
    casetasAmount: toll != null ? formatFuelEstimateMoney(toll) : null,
    perDiemAmount: perDiem != null ? formatFuelEstimateMoney(perDiem) : null,
  };
}

export type DestinationRateManualEditDetection = {
  operatorManual: boolean;
  chargeManual: boolean;
  casetasManual: boolean;
  perDiemManual: boolean;
  locked: boolean;
};

export function detectDestinationRateManualEdits(params: {
  operatorQuota: string;
  clientCharge: string;
  casetasAmount: string;
  perDiemAmount: string;
  lastAutoOperatorQuota: string;
  lastAutoClientCharge: string;
  lastAutoCasetasAmount: string;
  lastAutoPerDiemAmount: string;
}): DestinationRateManualEditDetection {
  const op = stripGroupedNumberInput(params.operatorQuota);
  const charge = stripGroupedNumberInput(params.clientCharge);
  const casetas = stripGroupedNumberInput(params.casetasAmount);
  const perDiem = stripGroupedNumberInput(params.perDiemAmount);
  const autoOp = stripGroupedNumberInput(params.lastAutoOperatorQuota);
  const autoCharge = stripGroupedNumberInput(params.lastAutoClientCharge);
  const autoCasetas = stripGroupedNumberInput(params.lastAutoCasetasAmount);
  const autoPerDiem = stripGroupedNumberInput(params.lastAutoPerDiemAmount);

  const operatorManual = autoOp !== '' && op !== '' && op !== autoOp;
  const chargeManual = autoCharge !== '' && charge !== '' && charge !== autoCharge;
  const casetasManual = autoCasetas !== '' && casetas !== '' && casetas !== autoCasetas;
  const perDiemManual = autoPerDiem !== '' && perDiem !== '' && perDiem !== autoPerDiem;

  return {
    operatorManual,
    chargeManual,
    casetasManual,
    perDiemManual,
    locked: operatorManual || chargeManual || casetasManual || perDiemManual,
  };
}
