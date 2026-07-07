import { resolveFleetStatus } from '@shared/utils/fleet/fleet-status.resolver';

/** Paridad A7: mismos inputs que backend → mismo output. */
describe('fleet-status.resolver (A7 parity)', () => {
  it('isActive false → inactive', () => {
    expect(
      resolveFleetStatus({
        status: 'available',
        isActive: false,
      }),
    ).toBe('inactive');
  });

  it('maintenanceFlag overrides trip and persisted status', () => {
    expect(
      resolveFleetStatus({
        status: 'available',
        isActive: true,
        maintenanceFlag: true,
        activeTripStatus: 'in_transit',
      }),
    ).toBe('maintenance');
  });

  it('activeTripStatus in_transit → in_use', () => {
    expect(
      resolveFleetStatus({
        status: 'available',
        isActive: true,
        activeTripStatus: 'in_transit',
      }),
    ).toBe('in_use');
  });

  it('activeTripStatus scheduled → scheduled', () => {
    expect(
      resolveFleetStatus({
        status: 'available',
        isActive: true,
        activeTripStatus: 'scheduled',
      }),
    ).toBe('scheduled');
  });

  it('falls back to persisted status when no active trip', () => {
    expect(
      resolveFleetStatus({
        status: 'maintenance',
        isActive: true,
      }),
    ).toBe('maintenance');
    expect(
      resolveFleetStatus({
        status: 'scheduled',
        isActive: true,
      }),
    ).toBe('scheduled');
  });
});
