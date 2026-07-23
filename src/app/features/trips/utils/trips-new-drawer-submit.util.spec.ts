import {
  buildTripsNewDrawerSubmitResult,
  isPlannedCompletionInPast,
  normalizeTripsNewDrawerPaymentMethod,
  parseTripsNewDrawerCreditDays,
  type TripsNewDrawerSubmitSnapshot,
} from '@features/trips/utils/trips-new-drawer-submit.util';
import type { MxPostalSettlement } from '@shared/services/mexico-postal-code.service';
import { localityKey } from '@features/trips/utils/mx-postal-settlement';

function settlement(
  partial: Pick<MxPostalSettlement, 'postalCode' | 'settlement' | 'settlementConsId'> &
    Partial<MxPostalSettlement>,
): MxPostalSettlement {
  return {
    postalCode: partial.postalCode,
    settlement: partial.settlement,
    settlementType: partial.settlementType ?? 'Colonia',
    municipality: partial.municipality ?? 'Álvaro Obregón',
    state: partial.state ?? 'Ciudad de México',
    city: partial.city ?? 'Ciudad de México',
    settlementConsId: partial.settlementConsId,
  };
}

function baseSnap(
  overrides: Partial<TripsNewDrawerSubmitSnapshot> = {},
): TripsNewDrawerSubmitSnapshot {
  const oS = settlement({
    postalCode: '01000',
    settlement: 'San Ángel',
    settlementConsId: 'o1',
  });
  const dS = settlement({
    postalCode: '11560',
    settlement: 'Polanco',
    settlementConsId: 'd1',
  });
  return {
    originCp: '01000',
    destinationCp: '11560',
    originSettlements: [oS],
    destinationSettlements: [dS],
    originLocalityKey: localityKey(oS),
    destinationLocalityKey: localityKey(dS),
    origin: 'San Ángel, CDMX',
    destination: 'Polanco, CDMX',
    includeClientBilling: true,
    clientName: 'Acme',
    clientId: 'cli-1',
    unitId: 'unit-1',
    unitMatchesConfig: true,
    unitConfigMismatchMessage: 'mismatch',
    assignedOperatorId: 'op-1',
    operationType: 'full',
    selectedOperationConfigId: 'cfg-1',
    selectedOperationConfigName: 'Full',
    usesMultipleEquipment: false,
    equipmentPrimaryId: 'eq-1',
    equipmentSecondaryId: '',
    equipmentPrimaryLabel: 'Caja 01',
    equipmentSecondaryLabel: '',
    plannedDepartureDateTime: '2026-08-01T08:00',
    plannedArrivalDateTime: '2026-08-01T12:00',
    plannedCompletionDateTime: '2026-08-01T18:00',
    dieselLiters: '100',
    dieselAmount: '2500',
    casetasAmount: '500',
    operatorQuota: '1200',
    perDiemAmount: '',
    clientCharge: '8000',
    creditDays: '15',
    requiresInvoice: true,
    paymentMethod: 'transfer',
    loadType: 'lleno',
    containerType: '40dc',
    cargoDescription: 'General',
    approximateWeightTons: '10',
    loadDate: '',
    loadPlace: '',
    routeKm: 40,
    matchedDestinationRateId: null,
    originOperationalCenterId: '',
    ...overrides,
  };
}

describe('trips-new-drawer-submit.util', () => {
  it('parses credit days and payment method', () => {
    expect(parseTripsNewDrawerCreditDays('')).toBe(0);
    expect(parseTripsNewDrawerCreditDays('12')).toBe(12);
    expect(parseTripsNewDrawerCreditDays('-1')).toBe(0);
    expect(normalizeTripsNewDrawerPaymentMethod('transfer')).toBe('transfer');
    expect(normalizeTripsNewDrawerPaymentMethod('nope')).toBe('cash');
  });

  it('detects planned completion in the past', () => {
    expect(
      isPlannedCompletionInPast('2020-01-01T00:00:00.000Z', Date.parse('2021-01-01')),
    ).toBe(true);
    expect(
      isPlannedCompletionInPast('2030-01-01T00:00:00.000Z', Date.parse('2021-01-01')),
    ).toBe(false);
  });

  it('rejects incomplete postal codes', () => {
    const res = buildTripsNewDrawerSubmitResult(baseSnap({ originCp: '123' }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain('códigos postales');
    }
  });

  it('builds payload for a valid snapshot', () => {
    const res = buildTripsNewDrawerSubmitResult(
      baseSnap(),
      Date.parse('2026-07-01T00:00:00.000Z'),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.completionInPast).toBe(false);
    expect(res.payload.unitId).toBe('unit-1');
    expect(res.payload.clientName).toBe('Acme');
    expect(res.payload.dieselLiters).toBe('100');
    expect(res.payload.creditDays).toBe(15);
    expect(res.payload.equipmentIds).toEqual(['eq-1']);
    expect(res.payload.operationConfigurationId).toBe('cfg-1');
  });

  it('requires both equipment ids for multi-equipment ops', () => {
    const res = buildTripsNewDrawerSubmitResult(
      baseSnap({
        usesMultipleEquipment: true,
        equipmentSecondaryId: '',
        selectedOperationConfigName: 'Full doble',
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain('Full doble');
    }
  });
});
