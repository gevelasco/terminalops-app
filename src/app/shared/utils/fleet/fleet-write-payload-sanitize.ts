/** Strip system-owned operational `status` from fleet API write payloads (A6). */
export function withoutFleetOperationalStatus<T extends Record<string, unknown>>(
  payload: T,
): Omit<T, 'status'> {
  const { status: _ignored, ...rest } = payload;
  return rest as Omit<T, 'status'>;
}
