export type WriteBackInput = {
  id: string;
  resolvedValue: string | null;
};

export type WriteBackUpdate = {
  id: string;
  text: string;
};

/**
 * Build canvas updates for a resolve batch.
 * Missing translations fall back to the scan-time original snapshot.
 */
export function buildWriteBackUpdates(
  results: WriteBackInput[],
  originals: Record<string, string>,
): WriteBackUpdate[] {
  const updates: WriteBackUpdate[] = [];
  for (const item of results) {
    const resolved = item.resolvedValue?.trim() ? item.resolvedValue : null;
    if (resolved !== null) {
      updates.push({ id: item.id, text: resolved });
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(originals, item.id)) {
      updates.push({ id: item.id, text: originals[item.id]! });
    }
  }
  return updates;
}
