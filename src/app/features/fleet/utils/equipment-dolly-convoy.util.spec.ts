import type { Equipment } from '@shared/models/logistics.models';
import {
  isDollyEquipmentType,
  pairingRequiresDollyBetween,
} from './equipment-dolly-convoy.util';

function eq(type: string): Equipment {
  return {
    id: '1',
    unitId: '',
    name: 'x',
    serialNumber: 's',
    lastServiceDate: '',
    type,
  };
}

describe('equipment-dolly-convoy.util', () => {
  it('detects dolly type', () => {
    expect(isDollyEquipmentType('dolly')).toBe(true);
    expect(isDollyEquipmentType('Dolly')).toBe(true);
  });

  it('requires dolly between two chassis or platforms', () => {
    expect(pairingRequiresDollyBetween(eq('portacontenedor'), eq('plataforma'))).toBe(true);
    expect(pairingRequiresDollyBetween(eq('caja_seca'), eq('plataforma'))).toBe(false);
    expect(pairingRequiresDollyBetween(eq('portacontenedor'), eq('dolly'))).toBe(false);
  });
});