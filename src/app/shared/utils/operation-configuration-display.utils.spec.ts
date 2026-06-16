import {
  operationConfigUserFacingLabel,
  resolveOperationConfiguration,
} from './operation-configuration-display.utils';

describe('operationConfigUserFacingLabel', () => {
  it('maps full to Doble articulado', () => {
    expect(operationConfigUserFacingLabel('Full')).toBe('Doble articulado');
    expect(operationConfigUserFacingLabel('Full histórico', 'full')).toBe('Doble articulado');
    expect(operationConfigUserFacingLabel('', 'full')).toBe('Doble articulado');
  });

  it('keeps other labels', () => {
    expect(operationConfigUserFacingLabel('Sencillo')).toBe('Sencillo');
    expect(operationConfigUserFacingLabel('Plataforma')).toBe('Plataforma');
  });
});

describe('resolveOperationConfiguration', () => {
  it('uses catalog name from snapshot', () => {
    const resolved = resolveOperationConfiguration({
      nameSnapshot: 'Sencillo',
      code: 'sencillo',
      catalog: [{ id: '8', code: 'sencillo', name: 'Sencillo', maxEquipmentCount: 1 }],
    });
    expect(resolved.label).toBe('Sencillo');
  });
});
