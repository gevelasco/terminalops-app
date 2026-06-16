/** Cuerpo parcial para PATCH /trips/:tripId/actual-schedule */
export interface UpdateActualSchedulePayload {
  departureAt?: string;
  arrivedAt?: string;
  returnAt?: string;
  justification: string;
}
