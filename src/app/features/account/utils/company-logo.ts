/** Límite del archivo original antes de comprimir (2 MB). */
export const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Lado máximo del logo en px (sidebar ~44px; deja margen para retina). */
const COMPANY_LOGO_MAX_EDGE = 384;

const COMPANY_LOGO_JPEG_QUALITY = 0.9;

export type CompanyLogoReadError = 'not-image' | 'too-large' | 'read-failed';

/**
 * Lee el logo de empresa y lo convierte a data URL redimensionada.
 * Conserva PNG (transparencia); el resto se guarda como JPEG.
 */
const ALLOWED_LOGO_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export function readCompanyLogoDataUrl(file: File): Promise<string> {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return Promise.reject(new Error('not-image' satisfies CompanyLogoReadError));
  }
  if (file.size > COMPANY_LOGO_MAX_BYTES) {
    return Promise.reject(new Error('too-large' satisfies CompanyLogoReadError));
  }

  const preferPng = file.type === 'image/png' || file.type === 'image/webp';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      if (!raw) {
        reject(new Error('read-failed' satisfies CompanyLogoReadError));
        return;
      }
      compressLogoDataUrl(raw, preferPng)
        .then(resolve)
        .catch(() =>
          reject(new Error('read-failed' satisfies CompanyLogoReadError)),
        );
    };
    reader.onerror = () =>
      reject(new Error('read-failed' satisfies CompanyLogoReadError));
    reader.readAsDataURL(file);
  });
}

export function companyLogoErrorMessage(code: string): string {
  switch (code) {
    case 'not-image':
      return 'Selecciona un archivo de imagen (PNG, JPG o WebP).';
    case 'too-large':
      return 'El logo debe pesar menos de 2 MB.';
    default:
      return 'No se pudo leer el logo.';
  }
}

function compressLogoDataUrl(
  dataUrl: string,
  preferPng: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const { width, height } = fitWithin(
          img.width,
          img.height,
          COMPANY_LOGO_MAX_EDGE,
        );
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('read-failed'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        if (preferPng) {
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(canvas.toDataURL('image/jpeg', COMPANY_LOGO_JPEG_QUALITY));
        }
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
