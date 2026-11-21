import { uniqueMaintEntryDocumentNames } from './fleet-maint-entry-doc-names.util';

describe('uniqueMaintEntryDocumentNames', () => {
  it('dedupes case-insensitively and skips empty', () => {
    expect(
      uniqueMaintEntryDocumentNames([' A.pdf ', 'a.PDF', '', '  ', 'b.pdf']),
    ).toEqual(['A.pdf', 'b.pdf']);
  });
});