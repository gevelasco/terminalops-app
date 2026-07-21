import { TestBed } from '@angular/core/testing';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import type { OperationConfiguration } from '@shared/models/operation-configuration.models';
import { OperationConfigurationResolverService } from './operation-configuration-resolver.service';

const CATALOG: OperationConfiguration[] = [
  {
    id: 'cfg-full',
    companyId: 'co-1',
    code: 'full',
    name: 'Full',
    maxEquipmentCount: 2,
    version: 3,
    active: true,
  },
  {
    id: 'cfg-sencillo',
    companyId: 'co-1',
    code: 'sencillo',
    name: 'Sencillo',
    maxEquipmentCount: 1,
    version: 1,
    active: true,
  },
];

describe('OperationConfigurationResolverService', () => {
  function setupResolver(configs: readonly OperationConfiguration[] = CATALOG) {
    TestBed.configureTestingModule({
      providers: [
        OperationConfigurationResolverService,
        {
          provide: OperationConfigurationsFeatureService,
          useValue: {
            configurations: () => configs,
            activeConfigurations: () => configs.filter((c) => c.active),
          },
        },
      ],
    });
    return TestBed.inject(OperationConfigurationResolverService);
  }

  it('resolves trip from live catalog by operationConfigurationId', () => {
    const resolver = setupResolver();
    const trip = {
      operationType: 'full',
      operationConfigurationId: 'cfg-full',
    };
    const ctx = resolver.contextFromTrip(trip);
    expect(resolver.resolveLabel(ctx)).toBe('Doble articulado');
    expect(resolver.resolveMaxEquipment(ctx)).toBe(2);
    expect(ctx.nameSnapshot).toBeUndefined();
  });

  it('returns consistent label, color and groupingKey for the same context', () => {
    const resolver = setupResolver();
    const trip = {
      operationType: 'sencillo',
      operationConfigurationId: 'cfg-sencillo',
    };
    const ctx = resolver.contextFromTrip(trip);
    const display = resolver.resolveTripDisplay(trip);

    expect(resolver.resolveLabel(ctx)).toBe(display.label);
    expect(resolver.resolveColor(ctx)).toBe(display.chartColor);
    expect(resolver.resolveGroupingKey(ctx)).toBe(display.groupingKey);
    expect(resolver.resolveBadge(ctx)).toBe(display.badgeClass);
  });

  it('maps diesel inputs only via maxEquipmentCount', () => {
    const resolver = setupResolver();
    const fullCtx = { operationConfigurationId: 'cfg-full', code: 'full' };
    const sencilloCtx = { operationConfigurationId: 'cfg-sencillo', code: 'sencillo' };

    expect(resolver.resolveMaxEquipment(fullCtx)).toBe(2);
    expect(resolver.usesMultipleEquipment(fullCtx)).toBe(true);
    expect(resolver.resolveConvoyMode([], fullCtx)).toBe('none');

    expect(resolver.resolveMaxEquipment(sencilloCtx)).toBe(1);
    expect(resolver.usesMultipleEquipment(sencilloCtx)).toBe(false);
  });
});
