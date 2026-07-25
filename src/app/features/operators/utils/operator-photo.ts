import {
  PROFILE_PHOTO_MAX_BYTES,
  profilePhotoErrorMessage,
  readProfilePhotoDataUrl,
} from '@core/utils/profile-photo';
import { initialsFromDisplayName } from '@core/services/state/user-profile';

export const OPERATOR_PHOTO_MAX_BYTES = PROFILE_PHOTO_MAX_BYTES;

export function operatorHasPhoto(photoDataUrl: string | undefined): boolean {
  return !!photoDataUrl?.trim();
}

export function operatorPhotoInitials(name: string): string {
  return initialsFromDisplayName(name);
}

/** Lee y comprime la foto del operador (mismo pipeline que avatar de usuario). */
export function readOperatorPhotoDataUrl(file: File): Promise<string> {
  return readProfilePhotoDataUrl(file);
}

export function operatorPhotoErrorMessage(code: string): string {
  return profilePhotoErrorMessage(code);
}
