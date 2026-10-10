/** TTL por defecto: reabrir drawer sin pegar al servidor; invalidación explícita tras PATCH. */
export const FLEET_ENTITY_DETAIL_CACHE_TTL_MS = 3 * 60 * 1000;

type FleetDetailCacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

/**
 * Caché en memoria del feature service (dispose limpia). No persiste entre módulos ni sesiones.
 */
export class FleetEntityDetailCache<T> {
  private readonly byId = new Map<string, FleetDetailCacheEntry<T>>();

  constructor(private readonly ttlMs: number = FLEET_ENTITY_DETAIL_CACHE_TTL_MS) {}

  get(id: string): T | null {
    const key = id.trim();
    if (!key) {
      return null;
    }
    const entry = this.byId.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.byId.delete(key);
      return null;
    }
    return entry.data;
  }

  set(id: string, data: T): void {
    const key = id.trim();
    if (!key) {
      return;
    }
    this.byId.set(key, { data, fetchedAt: Date.now() });
  }

  invalidate(id: string): void {
    const key = id.trim();
    if (key) {
      this.byId.delete(key);
    }
  }

  clear(): void {
    this.byId.clear();
  }
}
