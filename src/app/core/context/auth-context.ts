import { HttpContextToken } from '@angular/common/http';

/** Evita bucle de refresh en el reintento tras 401. */
export const AUTH_ALREADY_REFRESHED = new HttpContextToken<boolean>(() => false);
