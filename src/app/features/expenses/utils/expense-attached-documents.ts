import type {
  ExpenseAttachedDocument,
  ExpenseDocumentSlot,
} from '@shared/models/logistics.models';

/** Forma que espera el API al crear/actualizar documentos de gasto. */
export type ExpenseDocumentApiPayload = {
  id?: number;
  fileName: string;
  slot: ExpenseDocumentSlot;
  addedAt?: string;
};

function newExpenseDocumentId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Convierte archivos del input en referencias de expediente (metadatos). */
export function filesToExpenseDocuments(
  files: File[],
  slot: ExpenseDocumentSlot = 'receipt',
): ExpenseAttachedDocument[] {
  const addedAt = new Date().toISOString().slice(0, 10);
  return files.map((f) => ({
    id: newExpenseDocumentId(),
    fileName: f.name,
    slot,
    addedAt,
  }));
}

export function toExpenseDocumentsApiPayload(
  docs: readonly ExpenseAttachedDocument[] | undefined,
): ExpenseDocumentApiPayload[] {
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
