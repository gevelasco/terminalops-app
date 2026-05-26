/** Id público API (número, string u objeto con `id`) → clave estable para comparar. */
export function resourceIdKey(id: unknown): string {
  if (id == null) {
    return '';
  }
  if (typeof id === 'object') {
    const nested = (id as { id?: unknown }).id;
    if (nested != null && nested !== id) {
      return resourceIdKey(nested);
    }
    return '';
  }
  if (typeof id === 'number' || typeof id === 'bigint') {
    return String(id);
  }
  if (typeof id === 'string') {
    return id.trim();
  }
  return String(id).trim();
}

export function resourceIdsEqual(a: unknown, b: unknown): boolean {
  return resourceIdKey(a) === resourceIdKey(b);
}
