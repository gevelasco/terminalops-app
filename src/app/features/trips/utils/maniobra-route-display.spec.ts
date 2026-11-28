import {
  formatRouteKmEsMx,
  formatRouteKmInputValue,
  parseRouteKmOneWayInput,
} from './maniobra-route-display';

describe('parseRouteKmOneWayInput', () => {
  it('acepta km con separador de miles es-MX', () => {
    expect(parseRouteKmOneWayInput('1,234.8')).toBe(1234.8);
  });

  it('interpreta 1,200 como miles (no decimal)', () => {
    expect(parseRouteKmOneWayInput('1,200')).toBe(1200);
  });

  it('rechaza vacío, cero y valores fuera de rango', () => {
    expect(parseRouteKmOneWayInput('')).toBeNull();
    expect(parseRouteKmOneWayInput('0')).toBeNull();
    expect(parseRouteKmOneWayInput('20001')).toBeNull();
  });
});

describe('formatRouteKmInputValue', () => {
  it('formatea una decimal o deja vacío', () => {
    expect(formatRouteKmInputValue(672.84)).toBe(formatRouteKmEsMx(672.84));
    expect(formatRouteKmInputValue(null)).toBe('');
  });
});
