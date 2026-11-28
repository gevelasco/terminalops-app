/** Límite del archivo original antes de comprimir (2 MB). */
export const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Lado máximo del logo en px tras recorte.
 * Logos landscape (membrete) necesitan más ancho que el sidebar cuadrado.
 */
const COMPANY_LOGO_MAX_EDGE = 720;

const COMPANY_LOGO_JPEG_QUALITY = 0.92;

/** Umbral RGB para considerar “casi blanco” al recortar márgenes. */
const WHITE_TRIM_THRESHOLD = 246;

export type CompanyLogoReadError = 'not-image' | 'too-large' | 'read-failed';

/**
 * Lee el logo de empresa y lo convierte a data URL redimensionada.
 * Recorta márgenes blancos/transparentes y conserva la proporción.
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
        const source = document.createElement('canvas');
        source.width = Math.max(1, img.naturalWidth || img.width);
        source.height = Math.max(1, img.naturalHeight || img.height);
        const sourceCtx = source.getContext('2d');
        if (!sourceCtx) {
          reject(new Error('read-failed'));
          return;
        }
        sourceCtx.drawImage(img, 0, 0);
        const crop = trimWhitespaceBounds(
          sourceCtx.getImageData(0, 0, source.width, source.height),
        );

        const croppedW = Math.max(1, crop.w);
        const croppedH = Math.max(1, crop.h);
        const { width, height } = fitWithin(
          croppedW,
          croppedH,
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
        ctx.drawImage(
          source,
          crop.x,
          crop.y,
          croppedW,
          croppedH,
          0,
          0,
          width,
          height,
        );
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

function isNearWhiteOrTransparent(
  r: number,
  g: number,
  b: number,
  a: number,
): boolean {
  if (a < 12) {
    return true;
  }
  return (
    r >= WHITE_TRIM_THRESHOLD &&
    g >= WHITE_TRIM_THRESHOLD &&
    b >= WHITE_TRIM_THRESHOLD
  );
}

/** Recorta márgenes vacíos/blancos para que el logo no se vea “flotando”. */
function trimWhitespaceBounds(imageData: ImageData): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const { data, width, height } = imageData;
  let top = 0;
  let left = 0;
  let right = width - 1;
  let bottom = height - 1;
  let found = false;

  outerTop: for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (
        !isNearWhiteOrTransparent(
          data[i]!,
          data[i + 1]!,
          data[i + 2]!,
          data[i + 3]!,
        )
      ) {
        top = y;
        found = true;
        break outerTop;
      }
    }
  }
  if (!found) {
    return { x: 0, y: 0, w: width, h: height };
  }

  outerBottom: for (let y = height - 1; y >= top; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (
        !isNearWhiteOrTransparent(
          data[i]!,
          data[i + 1]!,
          data[i + 2]!,
          data[i + 3]!,
        )
      ) {
        bottom = y;
        break outerBottom;
      }
    }
  }

  outerLeft: for (let x = 0; x < width; x += 1) {
    for (let y = top; y <= bottom; y += 1) {
      const i = (y * width + x) * 4;
      if (
        !isNearWhiteOrTransparent(
          data[i]!,
          data[i + 1]!,
          data[i + 2]!,
          data[i + 3]!,
        )
      ) {
        left = x;
        break outerLeft;
      }
    }
  }

  outerRight: for (let x = width - 1; x >= left; x -= 1) {
    for (let y = top; y <= bottom; y += 1) {
      const i = (y * width + x) * 4;
      if (
        !isNearWhiteOrTransparent(
          data[i]!,
          data[i + 1]!,
          data[i + 2]!,
          data[i + 3]!,
        )
      ) {
        right = x;
        break outerRight;
      }
    }
  }

  const pad = 2;
  const x = Math.max(0, left - pad);
  const y = Math.max(0, top - pad);
  const w = Math.min(width - x, right - left + 1 + pad * 2);
  const h = Math.min(height - y, bottom - top + 1 + pad * 2);
  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
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
