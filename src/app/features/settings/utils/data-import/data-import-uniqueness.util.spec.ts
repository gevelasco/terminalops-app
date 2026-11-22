import type { DataImportCatalogSnapshot } from './data-import-catalog.types';
import { applyDataImportUniquenessRules } from './data-import-uniqueness.util';
import type { DataImportPreparedRow } from './data-import.types';

function emptyCatalog(): DataImportCatalogSnapshot {
  return {
    clientNames: new Set(),
    clientRfcs: new Set(),
    operatorNames: new Set(),
    operatorCurps: new Set(),
    operatorRfcs: new Set(),
    operatorLicenses: new Set(),
    unitPlates: new Set(),
    unitSerials: new Set(),
    unitMotors: new Set(),
    equipmentPlates: new Set(),
    equipmentSerials: new Set(),
    allPlates: new Set(),
    allSerials: new Set(),
  };
}

describe('applyDataImportUniquenessRules', () => {
  it('detecta placa duplicada en el archivo', () => {
    const rows: DataImportPreparedRow[] = [
      {
        kind: 'units',
        sheetName: 'Unidades',
        rowNumber: 2,
        status: 'ready',
        summary: 'ABC',
        errors: [],
        warnings: [],
        payload: { plate: 'ABC123', capacityKg: 0 },
      },
      {
        kind: 'units',
        sheetName: 'Unidades',
        rowNumber: 3,
        status: 'ready',
        summary: 'ABC',
        errors: [],
        warnings: [],
        payload: { plate: 'ABC123', capacityKg: 0 },
      },
    ];
    const out = applyDataImportUniquenessRules(rows, emptyCatalog());
    expect(out[1]?.status).toBe('error');
    expect(out[1]?.errors.some((e) => /placa duplicada/i.test(e))).toBe(true);
  });

  it('detecta placa ya existente en empresa', () => {
    const catalog = emptyCatalog();
    catalog.allPlates.add('XYZ99');
    const rows: DataImportPreparedRow[] = [
      {
        kind: 'equipment',
        sheetName: 'Equipos',
        rowNumber: 2,
        status: 'ready',
        summary: 'XYZ99',
        errors: [],
        warnings: [],
        payload: {
          name: 'R',
          serialNumber: 'SN1',
          plate: 'XYZ99',
        },
      },
    ];
    const out = applyDataImportUniquenessRules(rows, catalog);
    expect(out[0]?.status).toBe('error');
    expect(out[0]?.errors.some((e) => /base de datos/i.test(e))).toBe(true);
  });
});