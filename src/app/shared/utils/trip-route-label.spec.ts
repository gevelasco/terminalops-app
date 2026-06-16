import {
  formatCompactRouteEndpoint,
  formatCompactTripRouteLabel,
  formatTripRouteLabel,
} from './trip-route-label';

describe('trip-route-label', () => {
  it('formatTripRouteLabel keeps full origin and destination', () => {
    expect(
      formatTripRouteLabel('Origen largo', 'Destino largo'),
    ).toBe('Origen largo → Destino largo');
  });

  it('formatCompactRouteEndpoint strips país, CP y colonia', () => {
    expect(
      formatCompactRouteEndpoint(
        'Tapextles, Manzanillo, Colima, México (CP 28239)',
      ),
    ).toBe('Manzanillo, Colima');
  });

  it('formatCompactRouteEndpoint handles destination-style addresses', () => {
    expect(
      formatCompactRouteEndpoint(
        'El Colli Ejidal, Zapopan, Jalisco, México (CP 45070)',
      ),
    ).toBe('Zapopan, Jalisco');
  });

  it('formatCompactTripRouteLabel joins compact endpoints', () => {
    expect(
      formatCompactTripRouteLabel(
        'Tapextles, Manzanillo, Colima, México (CP 28239)',
        'El Colli Ejidal, Zapopan, Jalisco, México (CP 45070)',
      ),
    ).toBe('Manzanillo, Colima → Zapopan, Jalisco');
  });
});
