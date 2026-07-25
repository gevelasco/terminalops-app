/** Límite del archivo original antes de comprimir (2 MB). */
export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Lado máximo del avatar en px (mantiene sesión/login livianos). */
const PROFILE_PHOTO_MAX_EDGE = 256;

const PROFILE_PHOTO_JPEG_QUALITY = 0.85;

export type ProfilePhotoReadError = 'not-image' | 'too-large' | 'read-failed';

/**
 * Lee una imagen de perfil y la convierte a data URL JPEG redimensionada.
 * Así cabe en PATCH /users/me, en la respuesta de login y en sessionStorage.
 */
export function readProfilePhotoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('not-image' satisfies ProfilePhotoReadError));
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return Promise.reject(new Error('too-large' satisfies ProfilePhotoReadError));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      if (!raw) {
        reject(new Error('read-failed' satisfies ProfilePhotoReadError));
        return;
      }
      compressDataUrl(raw)
        .then(resolve)
        .catch(() =>
          reject(new Error('read-failed' satisfies ProfilePhotoReadError)),
        );
    };
    reader.onerror = () =>
      reject(new Error('read-failed' satisfies ProfilePhotoReadError));
    reader.readAsDataURL(file);
  });
}

export function profilePhotoErrorMessage(code: string): string {
  switch (code) {
    case 'not-image':
      return 'Selecciona un archivo de imagen.';
    case 'too-large':
      return 'La imagen debe pesar menos de 2 MB.';
    default:
      return 'No se pudo leer la imagen.';
  }
}

function compressDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const { width, height } = fitWithin(img.width, img.height, PROFILE_PHOTO_MAX_EDGE);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('read-failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', PROFILE_PHOTO_JPEG_QUALITY));
      } catch {
        reject(new Error('read-failed'));
      }
    };
    img.onerror = () => reject(new Error('read-failed'));
    img.src = dataUrl;
  });
}

function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}
