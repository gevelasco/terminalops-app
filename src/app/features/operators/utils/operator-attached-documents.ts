import type {
  OperatorAttachedDocument,
  OperatorDocumentSlot,
} from '@shared/models/logistics.models';

function newOperatorDocumentId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Convierte archivos locales del input en referencias mock (sin subir binario). */
export function filesToOperatorDocuments(
  files: File[],
  slot: OperatorDocumentSlot,
): OperatorAttachedDocument[] {
  const addedAt = new Date().toISOString().slice(0, 10);
  return files.map((f) => ({
    id: newOperatorDocumentId(),
    fileName: f.name,
    slot,
    addedAt,
  }));
}
