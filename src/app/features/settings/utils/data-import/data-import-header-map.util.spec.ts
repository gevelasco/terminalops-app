import { dataImportHeaderToFieldKey } from './data-import-header-map.util';

describe('dataImportHeaderToFieldKey (clients)', () => {
  it('resuelve encabezados legibles y claves técnicas heredadas', () => {
    expect(dataImportHeaderToFieldKey('clients', 'Nombre o razón social *')).toBe('nombre');
    expect(dataImportHeaderToFieldKey('clients', 'nombre')).toBe('nombre');
    expect(dataImportHeaderToFieldKey('clients', 'Razón social en factura')).toBe(
      'razon_social_factura',
    );
    expect(dataImportHeaderToFieldKey('clients', 'Límite o volumen de crédito (Alerta)')).toBe(
      'limite_credito',
    );
  });
});