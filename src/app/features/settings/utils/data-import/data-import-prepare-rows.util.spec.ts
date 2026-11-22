import { prepareDataImportRows } from './data-import-prepare-rows.util';

describe('prepareDataImportRows', () => {
  it('valida cliente con nombre obligatorio', () => {
    const rows = prepareDataImportRows('clients', 'Clientes', [{ nombre: 'ACME SA' }]);
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe('ready');
  });

  it('no valida formato de RFC (solo unicidad después)', () => {
    const rows = prepareDataImportRows('clients', 'Clientes', [
      { nombre: 'Cliente prueba', rfc: 'X123' },
    ]);
    expect(rows[0]?.status).toBe('ready');
    expect(rows[0]?.errors).toEqual([]);
    expect((rows[0]?.payload as { rfc?: string }).rfc).toBe('X123');
  });

  it('mapea crédito y razón social en factura desde claves de expediente', () => {
    const rows = prepareDataImportRows('clients', 'Clientes', [
      {
        nombre: 'Comercializadora Norte',
        razon_social_factura: 'Comercializadora Norte SA de CV',
        credito_otorgado: 'Sí',
        dias_credito: '15',
        limite_credito: '1 MMXN',
      },
    ]);
    expect(rows[0]?.status).toBe('ready');
    const payload = rows[0]?.payload as {
      billing?: { invoiceLegalName?: string };
      payment?: { approximateCreditAmount?: string; creditDays?: number };
    };
    expect(payload.billing?.invoiceLegalName).toBe('Comercializadora Norte SA de CV');
    expect(payload.payment?.approximateCreditAmount).toBe('1 MMXN');
    expect(payload.payment?.creditDays).toBe(15);
  });

  it('marca error si falta número de licencia en operador', () => {
    const rows = prepareDataImportRows('operators', 'Operadores', [
      { nombre: 'Juan', licencia_vigencia: '2030-01-01' },
    ]);
    expect(rows[0]?.status).toBe('error');
  });

  it('unidad: solo obliga placa, marca, versión y año', () => {
    const rows = prepareDataImportRows('units', 'Unidades', [
      {
        placa: 'XYZ99',
        marca: 'Kenworth',
        version: 'T800',
        modelo_ano: 'abc',
        capacidad_ton: 'no-numero',
      },
    ]);
    expect(rows[0]?.status).toBe('ready');
    expect((rows[0]?.payload as { plate: string }).plate).toBe('XYZ99');
  });

  it('operador sin formato estricto: solo exige licencia', () => {
    const rows = prepareDataImportRows('operators', 'Operadores', [
      {
        licencia_numero: 'CMX-99',
        nombre: 'Pedro',
        licencia_vigencia: 'mal-fecha',
        curp: 'corto',
      },
    ]);
    expect(rows[0]?.status).toBe('ready');
    expect((rows[0]?.payload as { licenseNumber: string }).licenseNumber).toBe('CMX-99');
  });

  it('equipo: omite fila (ejemplo) de plantilla', () => {
    const rows = prepareDataImportRows('equipment', 'Equipos', [
      {
        placa: '(ejemplo) 98-XY-1',
        marca: 'Great Dane',
        tipo_equipo: 'Caja seca',
        modelo_ano: '2021',
      },
    ]);
    expect(rows.length).toBe(0);
  });

  it('equipo: acepta tipo fuera de catálogo y solo exige placa, marca, tipo y año', () => {
    const rows = prepareDataImportRows('equipment', 'Equipos', [
      {
        placa: 'EQ-771',
        marca: 'Utility',
        tipo_equipo: 'Tipo personalizado',
        modelo_ano: '2019',
        costo_seguro: 'no-numero',
      },
    ]);
    expect(rows[0]?.status).toBe('ready');
    const payload = rows[0]?.payload as { type: string; plate: string };
    expect(payload.plate).toBe('EQ-771');
    expect(payload.type).toBe('Tipo personalizado');
  });

  it('equipo dolly: acepta fila sin placa con número de serie', () => {
    const rows = prepareDataImportRows('equipment', 'Equipos', [
      {
        marca: 'Utility',
        tipo_equipo: 'dolly',
        modelo_ano: '2020',
        numero_serie: 'DLY-001',
      },
    ]);
    expect(rows[0]?.status).toBe('ready');
    const payload = rows[0]?.payload as { plate?: string; serialNumber: string };
    expect(payload.plate).toBeUndefined();
    expect(payload.serialNumber).toBe('DLY-001');
  });
});