import type {
  Operator,
  OperatorAttachedDocument,
} from '@shared/models/logistics.models';
import { withoutFleetOperationalStatus } from '@shared/utils/fleet/fleet-write-payload-sanitize';

/** Documento listo para create/PATCH: omite ids locales (`doc-…`). */
export type OperatorDocumentApiPayload = {
  id?: number;
  fileName: string;
  slot: OperatorAttachedDocument['slot'];
  addedAt?: string;
};

export function toOperatorDocumentApiPayload(
  doc: OperatorAttachedDocument,
): OperatorDocumentApiPayload {
  const idNum = Number(doc.id);
  const payload: OperatorDocumentApiPayload = {
    fileName: doc.fileName,
    slot: doc.slot,
  };
  if (Number.isInteger(idNum) && idNum > 0) {
    payload.id = idNum;
  }
  const addedAt = doc.addedAt?.trim();
  if (addedAt) {
    payload.addedAt = addedAt;
  }
  return payload;
}

export function toOperatorDocumentsApiPayload(
  docs: readonly OperatorAttachedDocument[] | undefined,
): OperatorDocumentApiPayload[] {
  return (docs ?? []).map(toOperatorDocumentApiPayload);
}

/** Body de alta: mismos campos del operador, documentos saneados. */
export function buildOperatorCreatePayload(
  operator: Omit<Operator, 'id'>,
): Record<string, unknown> {
  const { status: _status, ...rest } = operator as Operator & {
    status?: string;
  };
  return {
    ...rest,
    isActive: operator.isActive !== false,
    documents: toOperatorDocumentsApiPayload(operator.documents),
  };
}

/** PATCH operador: excluye `status` (system-owned) y sanea documentos. */
export function buildOperatorPatchPayload(
  operator: Operator,
): Omit<Operator, 'status' | 'documents'> & {
  isActive: boolean;
  documents: OperatorDocumentApiPayload[];
} {
  const base = withoutFleetOperationalStatus({
    ...operator,
    isActive: operator.isActive !== false,
  }) as Omit<Operator, 'status'> & { isActive: boolean };

  const { documents: _docs, ...rest } = base;
  return {
    ...rest,
    documents: toOperatorDocumentsApiPayload(operator.documents),
  };
}
