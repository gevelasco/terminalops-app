import type { Operator } from '@shared/models/logistics.models';
import {
  buildOperatorCreatePayload,
  buildOperatorPatchPayload,
  type OperatorDocumentApiPayload,
} from './operator-api-payload';

function baseOperator(overrides: Partial<Operator> = {}): Operator {
  return {
    id: '3',
    name: 'Juan Pérez',
    status: 'in_use',
    isActive: true,
    documents: [],
    ...overrides,
  } as Operator;
}

describe('operator-api-payload (A6)', () => {
  it('never sends operational status in patch payload', () => {
    const payload = buildOperatorPatchPayload(baseOperator());
    expect('status' in (payload as object)).toBe(false);
  });

  it('includes isActive for user-controlled visibility', () => {
    const payload = buildOperatorPatchPayload(baseOperator({ isActive: false }));
    expect(payload.isActive).toBe(false);
  });

  it('omits local document ids on create/patch', () => {
    const docs = [
      {
        id: 'doc-local-1',
        fileName: 'contrato.pdf',
        slot: 'operation' as const,
        addedAt: '2026-07-25',
      },
      {
        id: '12',
        fileName: 'imss.pdf',
        slot: 'insurance' as const,
        addedAt: '2026-07-25',
      },
    ];
    const expected: OperatorDocumentApiPayload[] = [
      { fileName: 'contrato.pdf', slot: 'operation', addedAt: '2026-07-25' },
      { id: 12, fileName: 'imss.pdf', slot: 'insurance', addedAt: '2026-07-25' },
    ];
    const createPayload = buildOperatorCreatePayload(
      baseOperator({ documents: docs }),
    );
    const patchPayload = buildOperatorPatchPayload(
      baseOperator({ documents: docs }),
    );
    expect(createPayload['documents']).toEqual(expected);
    expect(patchPayload.documents).toEqual(expected);
  });
});
