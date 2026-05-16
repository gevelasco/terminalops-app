import { Operator } from '@shared/models/logistics.models';

/** Mapa `operadorId` → nombre para tablas y drawers. */
export function operatorNamesById(operators: Operator[]): Map<string, string> {
  return new Map(operators.map((o) => [o.id, o.name]));
}
