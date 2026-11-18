import type { ShareReplayConfig } from 'rxjs';

/**
 * Cache corto de GET en memoria. `shareReplay` ya reinicia el conector tras error
 * (`resetOnError: true` interno); con `refCount` se cancela la petición al no haber suscriptores.
 */
export const API_SHARE_REPLAY_CACHE: ShareReplayConfig = {
  bufferSize: 1,
  refCount: true,
};