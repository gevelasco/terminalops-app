import { HttpErrorResponse } from '@angular/common/http';

export function dataImportHttpErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (typeof body === 'string' && body.trim()) {
      return body.trim();
    }
    if (body && typeof body === 'object') {
      const msg = (body as { message?: unknown }).message;
      if (Array.isArray(msg)) {
        return msg.map(String).join(' ');
      }
      if (typeof msg === 'string' && msg.trim()) {
        return msg.trim();
      }
    }
    if (err.message) {
      return err.message;
    }
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Error al guardar';
}