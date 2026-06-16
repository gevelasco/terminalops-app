import { TestBed } from '@angular/core/testing';
import { buildOperationTypeSlicesFromTrips } from '@features/reports/utils/dashboard-charts-from-trips';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import type { OperationConfiguration } from '@shared/models/operation-configuration.models';
import { TripEvaluationService } from '@shared/services/trip-evaluation.service';
import {
  evaluatePersistedTrip,
  structuralGroupingKey,
} from '@shared/utils/trip-evaluation.engine';

const CATALOG: OperationConfiguration[] = [
  {
    id: 'cfg-full',
    companyId: 'co-1',
    code: 'full',
    name: 'Full Renombrado en vivo',
    maxEquipmentCount: 1,
    version: 99,
    active: true,
  },
];

const PERSISTED_TRIP = {
  operationType: 'full',
  operationConfigurationId: 'cfg-full',
  operationConfigurationNameSnapshot: 'Full histórico',
  operationConfigurationVersionSnapshot: 1,
  operationConfigurationMaxEquipmentCountSnapshot: 2,
  routeDistanceKm: 100,
  maneuverKind: 'foránea' as const,
  equipment: [],
};

describe('TripEvaluationService', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        TripEvaluationService,
        {
          provide: OperationConfigurationsFeatureService,
          useValue: {
            configurations: () => CATALOG,
            activeConfigurations: () => CATALOG,
          },
        },
      ],
    });
    return TestBed.inject(TripEvaluationService);
  }

  it('uses frozen snapshot fields only — immune to live catalog drift', () => {
    const svc = setup();
    const ev = svc.evaluateTrip(PERSISTED_TRIP);
    expect(ev.groupingKey).toBe('id:cfg-full');
    expect(ev.maxEquipmentCount).toBe(2);
    expect(ev.dieselCostBasis).toBe('full');
    expect(ev.configurationVersion).toBe(1);
    expect(svc.reportSliceLabel(ev)).toBe('Doble articulado');
  });

  it('evaluateDraft uses live catalog for active calculation', () => {
    const svc = setup();
    const ev = svc.evaluateDraft({
      operationConfigurationId: 'cfg-full',
      operationCode: 'full',
    });
    expect(ev.maxEquipmentCount).toBe(1);
    expect(ev.dieselCostBasis).toBe('sencillo');
    expect(ev.configurationVersion).toBe(99);
  });

  it('same trip → same evaluation result across modules (consistency audit)', () => {
    const svc = setup();
    const first = svc.evaluateTrip(PERSISTED_TRIP);
    const second = svc.evaluateTrip(PERSISTED_TRIP);
    expect(first).toEqual(second);

    const fromReports = buildOperationTypeSlicesFromTrips([PERSISTED_TRIP as never], svc);
    const fromDashboard = buildOperationTypeSlicesFromTrips([PERSISTED_TRIP as never], svc);
    expect(fromReports).toEqual(fromDashboard);
  });
});

describe('trip-evaluation.engine', () => {
  it('structural grouping key never uses display labels', () => {
    expect(structuralGroupingKey('abc', 'full')).toBe('id:abc');
    expect(structuralGroupingKey(undefined, 'full')).toBe('code:full');
  });

  it('persisted evaluation ignores catalog when computing diesel basis', () => {
    const ev = evaluatePersistedTrip(PERSISTED_TRIP);
    expect(ev.dieselCostBasis).toBe('full');
    expect(ev.groupingKey).toBe('id:cfg-full');
  });
});
