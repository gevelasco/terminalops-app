import {
  fleetCanEndMaintenance,
  fleetCanStartMaintenance,
  fleetMaintenanceAction,
} from './fleet-maintenance-toggle';

describe('fleet-maintenance-toggle', () => {
  it('allows start only for available resources not on route', () => {
    expect(
      fleetCanStartMaintenance({ status: 'available', onRoute: false, isActive: true }),
    ).toBe(true);
    expect(
      fleetCanStartMaintenance({ status: 'maintenance', onRoute: false, isActive: true }),
    ).toBe(false);
    expect(
      fleetCanStartMaintenance({ status: 'available', onRoute: true, isActive: true }),
    ).toBe(false);
    expect(
      fleetCanStartMaintenance({ status: 'available', onRoute: false, isActive: false }),
    ).toBe(false);
  });

  it('allows end only for maintenance resources not on route', () => {
    expect(fleetCanEndMaintenance({ status: 'maintenance', onRoute: false })).toBe(
      true,
    );
    expect(fleetCanEndMaintenance({ status: 'available', onRoute: false })).toBe(
      false,
    );
    expect(fleetCanEndMaintenance({ status: 'maintenance', onRoute: true })).toBe(
      false,
    );
  });

  it('resolves maintenance action priority', () => {
    expect(
      fleetMaintenanceAction({ status: 'maintenance', onRoute: false, isActive: true }),
    ).toBe('end');
    expect(
      fleetMaintenanceAction({ status: 'available', onRoute: false, isActive: true }),
    ).toBe('start');
    expect(
      fleetMaintenanceAction({ status: 'in_use', onRoute: false, isActive: true }),
    ).toBeNull();
  });
});
