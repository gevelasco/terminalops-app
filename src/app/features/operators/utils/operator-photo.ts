import { initialsFromDisplayName } from '@core/services/state/user-profile';

export const OPERATOR_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export function operatorHasPhoto(photoDataUrl: string | undefined): boolean {
  return !!photoDataUrl?.trim();
}

export function operatorPhotoInitials(name: string): string {
  return initialsFromDisplayName(name);
}

export function readOperatorPhotoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('not-image'));
  }
  if (file.size > OPERATOR_PHOTO_MAX_BYTES) {
    return Promise.reject(new Error('too-large'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      if (!url) {
        reject(new Error('read-failed'));
        return;
      }
      resolve(url);
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}
