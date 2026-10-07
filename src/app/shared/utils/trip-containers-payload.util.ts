import type { TripContainerType } from '@shared/models/logistics.models';
import { normalizeTripContainerType } from '@shared/catalogs/trip-container-type-options';
import {
  isValidTripContainerNumberInput,
  normalizeTripContainerNumberInput,
} from '@shared/utils/trip-container-number.util';

export type TripContainerFormSlot = {
  containerType: TripContainerType | string;
  containerNumber: string;
};

export type TripContainerPayloadSlot = {
  slot: number;
  containerType: TripContainerType;
  containerNumber?: string;
};

function slotHasData(slot: TripContainerFormSlot): boolean {
  const type = normalizeTripContainerType(String(slot.containerType));
  const num = normalizeTripContainerNumberInput(slot.containerNumber);
  return type !== 'na' || num.length > 0;
}

/** Arma `containers[]` para la API (omite slots vacíos). */
export function buildTripContainersPayload(
  slots: readonly TripContainerFormSlot[],
): TripContainerPayloadSlot[] {
  const out: TripContainerPayloadSlot[] = [];
  slots.forEach((slot, index) => {
    if (!slotHasData(slot)) {
      return;
    }
    const containerType = normalizeTripContainerType(String(slot.containerType));
    const containerNumber = normalizeTripContainerNumberInput(slot.containerNumber);
    out.push({
      slot: index + 1,
      containerType,
      ...(containerNumber ? { containerNumber } : {}),
    });
  });
  return out;
}

export function validateTripContainerNumbers(
  slots: readonly TripContainerFormSlot[],
): string | null {
  for (const slot of slots) {
    const num = normalizeTripContainerNumberInput(slot.containerNumber);
    if (num && !isValidTripContainerNumberInput(num)) {
      return 'El número de contenedor debe tener 4 letras y 7 dígitos (formato ISO).';
    }
  }
  return null;
}
