import {
  coerceContainerSlotForOperationType,
  containerSlotFieldApplies,
  containerSlotSelectOptionsForOperationType,
  resolveContainerSlotConfigKey,
  resolveEquipmentOperationTypeCode,
} from './equipment-container-slot-options.util';

describe('equipment-container-slot-options.util', () => {
  it('resolves equipment type from stored label', () => {
    expect(resolveEquipmentOperationTypeCode('Caja seca (dry van)')).toBe('caja_seca');
  });

  it('offers ISO slots only for portacontenedor in ascending order', () => {
    const options = containerSlotSelectOptionsForOperationType('portacontenedor');
    expect(options.map((option) => option.value)).toEqual([
      'iso_20',
      'iso_40',
      'iso_20_20',
      'fixed',
    ]);
  });

  it('offers box lengths for caja seca in ascending order', () => {
    const options = containerSlotSelectOptionsForOperationType('caja_seca');
    expect(options.map((option) => option.value)).toEqual(['ft_48', 'ft_53']);
    expect(options.some((option) => option.value.startsWith('iso_'))).toBe(false);
  });

  it('offers platform lengths in ascending order', () => {
    const options = containerSlotSelectOptionsForOperationType('plataforma');
    expect(options.map((option) => option.value)).toEqual([
      'ft_40',
      'ft_42',
      'ft_46',
      'ft_48',
      'ft_53',
    ]);
  });

  it('hides configuration field for gondola', () => {
    expect(containerSlotFieldApplies('gondola')).toBe(false);
    expect(containerSlotSelectOptionsForOperationType('gondola')).toEqual([
      { value: 'na', label: 'No aplica' },
    ]);
  });

  it('coerces invalid ISO slot when switching to caja seca', () => {
    expect(coerceContainerSlotForOperationType('caja_seca', 'iso_40')).toBe('ft_53');
  });

  it('keeps valid slot when still allowed', () => {
    expect(coerceContainerSlotForOperationType('portacontenedor', 'iso_20')).toBe('iso_20');
  });

  it('resolves legacy fixed label', () => {
    expect(resolveContainerSlotConfigKey('Chasis fijo / cerrado')).toBe('fixed');
  });
});
