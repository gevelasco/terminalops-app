import { FLEET_TIRE_CONDITION_OPTIONS } from '@shared/catalogs/fleet-form-options';
import {
  fleetTireConditionDisplayLabel,
  fleetTireConditionLabelForValue,
  fleetTireConditionValueFromStored,
} from './fleet-tire-condition.util';

describe('fleet-tire-condition.util', () => {
  it('maps stored label back to catalog value', () => {
    const label = FLEET_TIRE_CONDITION_OPTIONS[1]!.label;
    expect(
      fleetTireConditionValueFromStored(label, FLEET_TIRE_CONDITION_OPTIONS),
    ).toBe('good');
  });

  it('formats display from value or label', () => {
    expect(
      fleetTireConditionDisplayLabel('good', FLEET_TIRE_CONDITION_OPTIONS),
    ).toContain('Buena');
    expect(
      fleetTireConditionLabelForValue('good', FLEET_TIRE_CONDITION_OPTIONS),
    ).toContain('Buena');
  });
});
