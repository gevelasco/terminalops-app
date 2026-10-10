import {
  fleetMaintenanceKmRemainingFromCounterInput,
  fleetMaintenanceResetsKmCounter,
  FLEET_MAINTENANCE_KM_RESET_TYPE,
  parseMaintenanceKmCounterInput,
} from './fleet-maintenance-km.util';

describe('fleetMaintenanceResetsKmCounter', () => {
  it('reinicia solo con servicio completo', () => {
    expect(fleetMaintenanceResetsKmCounter(FLEET_MAINTENANCE_KM_RESET_TYPE)).toBe(true);
    expect(fleetMaintenanceResetsKmCounter('mecanica_general')).toBe(false);
    expect(fleetMaintenanceResetsKmCounter('cambio_llantas')).toBe(false);
    expect(fleetMaintenanceResetsKmCounter('medio_servicio')).toBe(false);
    expect(fleetMaintenanceResetsKmCounter('')).toBe(false);
    expect(fleetMaintenanceResetsKmCounter(undefined)).toBe(false);
  });
});

describe('parseMaintenanceKmCounterInput', () => {
  it('acepta vacío como cero y enteros con separador de miles', () => {
    expect(parseMaintenanceKmCounterInput('')).toBe(0);
    expect(parseMaintenanceKmCounterInput('13,000')).toBe(13000);
    expect(parseMaintenanceKmCounterInput('13000.6')).toBe(13001);
  });

  it('rechaza negativos', () => {
    expect(parseMaintenanceKmCounterInput('-1')).toBe('invalid');
  });
});

describe('fleetMaintenanceKmRemainingFromCounterInput', () => {
  it('calcula km restantes con intervalo global', () => {
    const remaining = fleetMaintenanceKmRemainingFromCounterInput('13000', {
      kmControlEnabled: true,
      kmIntervalDefault: 20000,
      dateControlEnabled: false,
      datePeriod: null,
    });
    expect(remaining).toBe(7000);
  });
});
