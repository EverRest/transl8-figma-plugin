export type CreateKeysInput = {
  id: string;
  match: { keyId: string } | null;
  proposedKeyName: string | null;
};

export type CreateKeysItem = {
  key: string;
  sourceText: string;
};

/**
 * `proposedKeyName` used to be display-only: a resolve-batch row
 * with no match proposed a key name, but nothing in the plugin could turn
 * that into a real key — the dashboard's bulk-import flow was the only way.
 * This builds the request body for `POST /projects/:id/keys/bulk-import`
 * (already used elsewhere) from exactly the rows that need it: no existing
 * match, and a proposed name to create.
 *
 * Dedupes by key name (first occurrence wins) — two layers can propose the
 * same key, and bulk-import upserts by key anyway, so a duplicate in the
 * request body would just be redundant, not wrong, but sending it once is
 * the honest count of what will actually be created.
 */
export function buildCreateKeysPlan(
  results: CreateKeysInput[],
  sourceTextById: Record<string, string>,
): {
  items: CreateKeysItem[];
  skippedAlreadyMatched: number;
  skippedNoProposal: number;
  skippedDuplicate: number;
  skippedNoSourceText: number;
} {
  const items: CreateKeysItem[] = [];
  const seenKeys = new Set<string>();
  let skippedAlreadyMatched = 0;
  let skippedNoProposal = 0;
  let skippedDuplicate = 0;
  let skippedNoSourceText = 0;

  for (const row of results) {
    if (row.match) {
      skippedAlreadyMatched += 1;
      continue;
    }
    const key = row.proposedKeyName?.trim();
    if (!key) {
      skippedNoProposal += 1;
      continue;
    }
    if (seenKeys.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    // Backend requires a non-empty sourceText (BulkImportKeyItemDto,
    // @MinLength(1)) — a row this ever fires for would mean the scan
    // captured an id create-keys-plan doesn't have text for, which
    // shouldn't happen given both come from the same layer scan, but
    // failing the whole batch on the server for one bad row is worse
    // than skipping it here with a visible count.
    const sourceText = sourceTextById[row.id]?.trim();
    if (!sourceText) {
      skippedNoSourceText += 1;
      continue;
    }
    seenKeys.add(key);
    items.push({ key, sourceText });
  }

  return {
    items,
    skippedAlreadyMatched,
    skippedNoProposal,
    skippedDuplicate,
    skippedNoSourceText,
  };
}
