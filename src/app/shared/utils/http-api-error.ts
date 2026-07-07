import { HttpErrorResponse } from '@angular/common/http';

/** Mensaje legible desde respuestas Nest (string | message | message[]). */
export function parseHttpApiErrorMessage(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) {
    if (err instanceof Error) {
      const t = err.message.trim();
      return t || null;
    }
    if (typeof err === 'string') {
      const t = err.trim();
      return t || null;
    }
    return null;
  }

  const body = err.error;
  if (body == null) {
    return null;
  }
  if (typeof body === 'string') {
    const t = body.trim();
    return t || null;
  }
  if (typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') {
      const t = message.trim();
      return t || null;
    }
    if (Array.isArray(message)) {
      const parts = message
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter((part) => part.length > 0);
      return parts.length > 0 ? parts.join(' ') : null;
    }
  }
  return null;
}
