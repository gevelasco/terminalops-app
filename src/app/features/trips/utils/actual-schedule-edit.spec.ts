import type { Trip } from '@shared/models/logistics.models';
import {
  actualScheduleFieldHasChange,
  actualScheduleHasAnyChange,
  editableActualScheduleFields,
  isActualScheduleFieldEditable,
  seedActualScheduleDrafts,
  validateActualScheduleBeforeSave,
} from './actual-schedule-edit';

function tripFixture(
  partial: Partial<Trip> & Pick<Trip, 'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'>,
): Trip {
  return {
    id: '1',
    maneuverCode: 'TST-001',
    origin: 'A',
    destination: 'B',
    clientName: 'Cliente',
    status: 'in_transit',
    operationType: 'sencillo',
    loadType: 'lleno',
    containerType: '40dc',
    cargoDescription: '',
    approximateWeightTons: '',
    dieselLiters: '',
    dieselAmount: '',
    casetasAmount: '',
    operatorQuota: '',
    clientCharge: '',
    creditDays: 0,
    requiresInvoice: false,
    paymentMethod: 'cash',
    operatorId: '1',
    unitId: '1',
    equipment: [],
    equipmentIds: [],
    attachedDocumentFileNames: [],
    createdAt: '2026-01-15T07:15:00.000Z',
    departureAt: null,
    arrivedAt: null,
    returnAt: null,
    hasIncident: false,
    ...partial,
  } as Trip;
}

describe('actual-schedule-edit', () => {
  const trip = tripFixture({
    plannedDepartureAt: '2026-01-15T08:00:00.000Z',
    plannedArrivalAt: '2026-01-15T12:00:00.000Z',
    plannedCompletionAt: '2026-01-15T18:00:00.000Z',
  });

  it('seeds drafts from planned when no persisted real dates', () => {
    const drafts = seedActualScheduleDrafts(trip);
    expect(drafts.departureAt).toMatch(/T/);
    expect(actualScheduleHasAnyChange(trip, drafts)).toBe(false);
  });

  it('detects change against baseline persisted ?? planned', () => {
    const drafts = seedActualScheduleDrafts(trip);
    drafts.departureAt = '2026-01-15T02:30';
    expect(actualScheduleFieldHasChange(trip, 'departureAt', drafts.departureAt)).toBe(true);
  });

  it('builds partial payload for departure only when scheduled', () => {
    const scheduledTrip = tripFixture({
      status: 'scheduled',
      plannedDepartureAt: '2026-01-15T08:00:00.000Z',
      plannedArrivalAt: '2026-01-15T12:00:00.000Z',
      plannedCompletionAt: '2026-01-15T18:00:00.000Z',
    });
    const drafts = seedActualScheduleDrafts(scheduledTrip);
    drafts.departureAt = '2026-01-15T02:30';
    const result = validateActualScheduleBeforeSave(scheduledTrip, drafts, 'Tráfico');
    expect('payload' in result).toBe(true);
    if ('payload' in result) {
      expect(result.payload.departureAt).toBeTruthy();
      expect(result.payload.arrivedAt).toBeUndefined();
      expect(result.payload.justification).toBe('Tráfico');
    }
  });

  it('returns no_changes when drafts match baseline', () => {
    const drafts = seedActualScheduleDrafts(trip);
    const result = validateActualScheduleBeforeSave(trip, drafts, '');
    expect(result).toEqual({ error: 'no_changes' });
  });

  it('does not allow editing departure when in_transit', () => {
    expect(editableActualScheduleFields('in_transit')).toEqual(['arrivedAt', 'returnAt']);
    expect(isActualScheduleFieldEditable('in_transit', 'departureAt')).toBe(false);
    expect(isActualScheduleFieldEditable('scheduled', 'departureAt')).toBe(true);
  });

  it('rejects completion before client arrival', () => {
    const drafts = seedActualScheduleDrafts(trip);
    drafts.returnAt = '2026-01-15T05:00';
    const result = validateActualScheduleBeforeSave(trip, drafts, 'Ajuste');
    expect(result).toEqual({
      error: 'La fecha fin real no puede ser anterior a la llegada con cliente.',
    });
  });
});
