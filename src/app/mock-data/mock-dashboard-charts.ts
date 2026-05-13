/** Serie mock: maniobras completadas por día (últimos 7 días). */
export interface WeeklyTripPoint {
  day: string;
  value: number;
}

export const MOCK_WEEKLY_TRIP_VOLUME: WeeklyTripPoint[] = [
  { day: 'Lun', value: 18 },
  { day: 'Mar', value: 22 },
  { day: 'Mié', value: 15 },
  { day: 'Jue', value: 28 },
  { day: 'Vie', value: 31 },
  { day: 'Sáb', value: 12 },
  { day: 'Dom', value: 9 },
];

/** Segunda capa de contexto (mock) — alinea altura con la gráfica derecha. */
export interface OperationTypeSlice {
  label: string;
  count: number;
  pct: number;
  tone: 'a' | 'b' | 'c';
}

export const MOCK_OPERATION_TYPE_SLICES: OperationTypeSlice[] = [
  { label: 'Sencillo', count: 4, pct: 40, tone: 'a' },
  { label: 'Full', count: 4, pct: 40, tone: 'b' },
  { label: 'Plana', count: 2, pct: 20, tone: 'c' },
];
