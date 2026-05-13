import { Unit } from '@shared/models/logistics.models';

/** Catálogo alineado con `unitId` en maniobras mock (`TRK-*`). */
export const MOCK_UNITS: Unit[] = [
  {
    id: 'TRK-882',
    plate: '81-AA-9K',
    type: '53′ refrigerado',
    capacityKg: 24000,
    status: 'in_use',
    trailerBrandAbbr: 'HYU',
    trailerYear: '2021',
    fleetMeta: {
      trailerBrandName: 'Hyundai Translead',
      trailerVersion: 'Reefer HT',
      trailerTenureMode: 'financed',
      trailerRecurringPaymentAmount: 22500,
      trailerRecurringPaymentDate: '2026-05-15',
      trailerRecurringInstallmentCount: 48,
      lastMaintenanceDate: '2025-11-25',
      lastMaintenanceType: 'Servicio completo',
      lastMaintenanceCost: 4800,
      lastMaintenanceNotes:
        'Cambio de aceite y filtros, revisión de balatas, prueba de presión en sistema neumático.',
      maintenanceEntries: [
        {
          date: '2025-11-25',
          type: 'Servicio completo',
          cost: 4800,
          notes:
            'Cambio de aceite y filtros, revisión de balatas, prueba de presión en sistema neumático.',
          documentNames: ['factura-servicio-2025-11.pdf', 'checklist-taller.png'],
        },
        {
          date: '2025-06-10',
          type: 'Mecánica general',
          cost: 1850,
          notes: 'Ajuste de embrague y revisión de transmisión por ruido a baja velocidad.',
          documentNames: ['orden-servicio-06-2025.pdf'],
        },
        {
          date: '2024-12-02',
          type: 'Reparación eléctrica',
          cost: 1320,
        },
      ],
      verificationPhysMechDate: '2026-03-05',
      verificationPhysMechCost: 1240,
      verificationEmissionsDate: '2026-03-08',
      verificationEmissionsCost: 980.5,
      verificationDoubleArticulatedApplies: false,
      insurancePolicyNumber: 'GNP-TRK-882',
      insuranceContractDate: '2025-08-15',
      insurancePaymentCadence: 'annual',
      insuranceCost: 18500,
    },
  },
  {
    id: 'TRK-441',
    plate: '45-RP-7M',
    type: 'Caja seca',
    capacityKg: 18000,
    status: 'available',
    trailerBrandAbbr: 'UT',
    trailerYear: '2019',
    fleetMeta: {
      trailerBrandName: 'Utility Trailer',
      trailerTenureMode: 'leased',
      trailerRecurringPaymentAmount: 42000,
      trailerRecurringPaymentDate: '2026-05-01',
      trailerRecurringInstallmentCount: 24,
      lastMaintenanceDate: '2023-04-01',
      lastMaintenanceType: 'Reparación eléctrica',
      lastMaintenanceCost: 1850,
      lastMaintenanceNotes: 'Falla en arnés de luces traseras; reemplazo de socket y plafones.',
      maintenanceEntries: [
        {
          date: '2023-04-01',
          type: 'Reparación eléctrica',
          cost: 1850,
          notes: 'Falla en arnés de luces traseras; reemplazo de socket y plafones.',
          documentNames: ['recibo-electrico.pdf'],
        },
        {
          date: '2022-11-18',
          type: 'Medio servicio',
          cost: 2400,
          notes: 'Cambio de aceite y rotación de llantas.',
        },
      ],
      verificationPhysMechDate: '2026-02-10',
      verificationEmissionsDate: '2025-12-08',
      verificationDoubleArticulatedApplies: false,
      insurancePolicyNumber: 'AXA-441',
      insuranceContractDate: '2026-04-20',
      insurancePaymentCadence: 'monthly',
      insuranceCost: 1650,
    },
  },
  {
    id: 'TRK-204',
    plate: '19-KL-3T',
    type: 'Plataforma',
    capacityKg: 22000,
    status: 'in_use',
    trailerBrandAbbr: 'WB',
    trailerYear: '2020',
    fleetMeta: {
      trailerBrandName: 'Wilson Trailer',
      trailerVersion: 'Drop deck',
      trailerTenureMode: 'owned',
      trailerCommercialValue: 320000,
      lastMaintenanceDate: '2022-01-10',
      verificationPhysMechDate: '2024-06-01',
      verificationEmissionsDate: '2024-08-15',
      verificationDoubleArticulatedApplies: false,
      insurancePolicyNumber: 'ZUR-204',
      insuranceContractDate: '2025-09-01',
      insurancePaymentCadence: 'annual',
    },
  },
  {
    id: 'TRK-118',
    plate: '72-NB-2W',
    type: 'Dry van',
    capacityKg: 16000,
    status: 'available',
    trailerBrandAbbr: 'GD',
    trailerYear: '2018',
    fleetMeta: {
      trailerBrandName: 'Great Dane',
      trailerTenureMode: 'managed',
      trailerManagementOwnerPayout: 12000,
      lastMaintenanceDate: '2026-02-01',
      verificationPhysMechDate: '2026-04-01',
      verificationEmissionsDate: '2026-04-02',
      verificationDoubleArticulatedApplies: false,
      insurancePolicyNumber: 'GNP-118',
      insuranceContractDate: '2025-11-01',
      insurancePaymentCadence: 'annual',
    },
  },
  {
    id: 'TRK-909',
    plate: '08-MX-5R',
    type: 'Refrigerado',
    capacityKg: 23000,
    status: 'in_use',
    trailerBrandAbbr: 'KR',
    trailerYear: '2022',
    fleetMeta: {
      trailerBrandName: 'Krone',
      lastMaintenanceDate: '2025-12-01',
      verificationPhysMechDate: '2025-11-28',
      verificationEmissionsDate: '2026-03-20',
      verificationDoubleArticulatedApplies: false,
      insurancePolicyNumber: 'POL-909',
      insuranceContractDate: '2026-05-02',
      insurancePaymentCadence: 'quarterly',
    },
  },
  {
    id: 'TRK-330',
    plate: '56-ZZ-8P',
    type: 'Porta High Cube',
    capacityKg: 21000,
    status: 'scheduled',
    trailerBrandAbbr: 'HT',
    trailerYear: '2023',
    fleetMeta: {
      trailerBrandName: 'Hyundai Translead',
      trailerVersion: 'HC',
      lastMaintenanceDate: '2026-01-15',
      verificationPhysMechDate: '2026-02-28',
      verificationEmissionsDate: '2026-03-01',
      verificationDoubleArticulatedApplies: false,
    },
  },
  {
    id: 'TRK-501',
    plate: '34-DC-1Q',
    type: 'Plana',
    capacityKg: 25000,
    status: 'available',
    trailerBrandAbbr: 'FN',
    trailerYear: '2017',
    fleetMeta: {
      trailerBrandName: 'Fontaine',
      lastMaintenanceDate: '2025-12-20',
      verificationPhysMechDate: '2026-02-15',
      verificationEmissionsDate: '2026-02-18',
      verificationDoubleArticulatedApplies: false,
      insurancePolicyNumber: 'HDI-501',
      insuranceContractDate: '2025-06-10',
      insurancePaymentCadence: 'annual',
    },
  },
  {
    id: 'TRK-775',
    plate: '91-BT-6V',
    type: 'Góndola',
    capacityKg: 28000,
    status: 'maintenance',
    trailerBrandAbbr: 'MN',
    trailerYear: '2016',
    fleetMeta: {
      trailerBrandName: 'Monon',
      lastMaintenanceDate: '2021-05-01',
      verificationPhysMechDate: '2023-01-10',
      verificationEmissionsDate: '2023-02-01',
      verificationDoubleArticulatedApplies: false,
      insurancePolicyNumber: 'LEG-775',
      insuranceContractDate: '2025-04-01',
      insurancePaymentCadence: 'annual',
    },
  },
  {
    id: 'TRK-612',
    plate: '63-HY-4L',
    type: 'Dry van',
    capacityKg: 17500,
    status: 'available',
    trailerBrandAbbr: 'ST',
    trailerYear: '2020',
    fleetMeta: {
      trailerBrandName: 'Stoughton',
    },
  },
  {
    id: 'TRK-148',
    plate: '27-WS-9N',
    type: 'Torton / caja',
    capacityKg: 12000,
    status: 'in_use',
    trailerBrandAbbr: 'WB',
    trailerYear: '2024',
    fleetMeta: {
      trailerBrandName: 'Wilson Trailer',
      lastMaintenanceDate: '2026-04-20',
      verificationPhysMechDate: '2026-04-01',
      verificationEmissionsDate: '2026-04-05',
      verificationDoubleArticulatedApplies: true,
      verificationDoubleArticulatedDate: '2026-04-03',
      verificationDoubleArticulatedCost: 450,
      insurancePolicyNumber: 'POL-148',
      insuranceContractDate: '2026-01-05',
      insurancePaymentCadence: 'annual',
    },
  },
];

/** Etiqueta para selects: `Marca - Año - Placas`. */
export function formatUnitTrailerLabel(u: Unit): string {
  const brand =
    u.fleetMeta?.trailerBrandName?.trim() || u.trailerBrandAbbr?.trim() || '';
  const year = (u.trailerYear ?? '').trim();
  const plates = u.plate.trim();
  return `${brand} - ${year} - ${plates}`;
}

/**
 * Id operativo visible: abreviatura-año-placas (ej. `HYU-2021-81-AA-9K`).
 * Si faltan datos, se usa el `id` interno (p. ej. `TRK-882`).
 */
export function formatUnitTrailerOperationalId(u: Unit): string {
  const abbr = (u.trailerBrandAbbr ?? '').trim().toUpperCase();
  const year = (u.trailerYear ?? '').trim();
  const plate = u.plate.trim().replace(/\s+/g, '-');
  if (abbr && year && plate) {
    return `${abbr}-${year}-${plate}`;
  }
  return u.id.trim();
}

/** Etiqueta visible a partir del id guardado en la maniobra (mismo formato que al programar). */
export function labelForUnitId(unitId: string): string {
  const id = unitId.trim();
  const u = MOCK_UNITS.find((x) => x.id === id);
  return u ? formatUnitTrailerLabel(u) : id;
}
