import type {
  ClientAttachedDocument,
  ClientDocumentSlot,
} from '@shared/models/client.models';

function newClientDocumentId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Convierte archivos del input en referencias de expediente (metadatos). */
export function filesToClientDocuments(
  files: File[],
  slot: ClientDocumentSlot = 'fiscal',
): ClientAttachedDocument[] {
  const addedAt = new Date().toISOString().slice(0, 10);
  return files.map((f) => ({
    id: newClientDocumentId(),
    fileName: f.name,
    slot,
    addedAt,
  }));
}

export function toClientDocumentsApiPayload(
  docs: readonly ClientAttachedDocument[] | undefined,
): Array<{
  id?: number;
  fileName: string;
  slot: ClientDocumentSlot;
  addedAt?: string;
}> {
  return (docs ?? []).map((doc) => {
    const idNum = Number(doc.id);
    return {
      ...(Number.isInteger(idNum) && idNum > 0 ? { id: idNum } : {}),
      fileName: doc.fileName,
      slot: doc.slot,
      ...(doc.addedAt?.trim() ? { addedAt: doc.addedAt.trim() } : {}),
    };
  });
}
