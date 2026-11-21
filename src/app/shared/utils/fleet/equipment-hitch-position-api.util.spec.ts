import {
  mapAppHitchPositionToApiWrite,
  resolveAppHitchPositionFromApi,
} from './equipment-hitch-position-api.util';

describe('equipment-hitch-position-api.util', () => {
  it('maps dolly api rear to app middle', () => {
    expect(resolveAppHitchPositionFromApi('rear', 'dolly')).toBe('middle');
  });

  it('keeps lead and rear for trailers', () => {
    expect(resolveAppHitchPositionFromApi('lead', 'portacontenedor')).toBe('lead');
    expect(resolveAppHitchPositionFromApi('rear', 'caja_seca')).toBe('rear');
  });

  it('writes dolly middle as rear when only lead is on unit', () => {
    expect(
      mapAppHitchPositionToApiWrite('middle', 'dolly', {
        peersOnUnit: [
          { id: '1', type: 'portacontenedor', hitchPosition: 'lead' },
        ],
        equipmentId: 'dolly-1',
      }),
    ).toBe('rear');
  });

  it('writes dolly without api hitch slot when lead and rear trailers exist', () => {
    expect(
      mapAppHitchPositionToApiWrite('middle', 'dolly', {
        peersOnUnit: [
          { id: '1', type: 'portacontenedor', hitchPosition: 'lead' },
          { id: '2', type: 'portacontenedor', hitchPosition: 'rear' },
        ],
        equipmentId: 'dolly-1',
      }),
    ).toBeNull();
  });

  it('reads middle from api response', () => {
    expect(resolveAppHitchPositionFromApi('middle', 'dolly')).toBe('middle');
  });
});