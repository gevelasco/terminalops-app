import {
  buildSuggestedDataImportMapping,
  dataImportMissingRequiredFields,
  uniqueDataImportHeaders,
} from './data-import-column-map.util';

describe('data-import-column-map', () => {
  it('uniqueDataImportHeaders distingue duplicados', () => {
    expect(uniqueDataImportHeaders(['Placa', 'Placa', ''])).toEqual([
      'Placa',
      'Placa (2)',
      '(sin título)',
    ]);
  });

  it('auto-mapea columnas de unidades sin repetir campos', () => {
    const mapping = buildSuggestedDataImportMapping('units', [
      { header: 'Placa', rawHeader: 'Placa' },
      { header: 'Marca', rawHeader: 'Marca' },
      { header: 'Serie', rawHeader: 'Número serie / VIN' },
      { header: 'Otra placa', rawHeader: 'Placa secundaria' },
    ]);
    expect(mapping['Placa']).toBe('placa');
    expect(mapping['Marca']).toBe('marca');
    expect(mapping['Serie']).toBe('numero_serie');
    const values = Object.values(mapping);
    expect(new Set(values).size).toBe(values.length);
  });

  it('detecta campos obligatorios faltantes', () => {
    expect(dataImportMissingRequiredFields('clients', { A: 'rfc' })).toEqual([
      'nombre',
    ]);
    expect(dataImportMissingRequiredFields('clients', { A: 'nombre' })).toEqual([]);
  });
});
