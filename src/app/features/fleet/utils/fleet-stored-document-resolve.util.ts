import type { FleetStoredDocument } from '@shared/models/logistics.models';

export function findFleetStoredDocumentByFileName(
  fileName: string,
  pools: readonly (readonly FleetStoredDocument[])[],
): FleetStoredDocument | undefined {
  const target = fileName.trim().toLowerCase();
  if (!target) {
    return undefined;
  }
  for (const pool of pools) {
    for (const doc of pool) {
      if (doc.fileName.trim().toLowerCase() === target) {
        return doc;
      }
    }
  }
  return undefined;
}