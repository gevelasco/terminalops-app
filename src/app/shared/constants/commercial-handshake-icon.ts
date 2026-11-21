import { APP_MODULE_CODES, type StaffGrantableModuleCode } from '@shared/models/app-modules.models';

/** Icono acuerdo comercial (tarifa / módulo Comercial). */
export const COMMERCIAL_HANDSHAKE_ICON_SRC = '/icons/handshake-solid.png';

export const COMMERCIAL_HANDSHAKE_ICON_MASK = `url(${COMMERCIAL_HANDSHAKE_ICON_SRC})`;

export function commercialClientsModuleIconSrc(
  code: StaffGrantableModuleCode | string,
): string | undefined {
  return code === APP_MODULE_CODES.CLIENTS ? COMMERCIAL_HANDSHAKE_ICON_SRC : undefined;
}