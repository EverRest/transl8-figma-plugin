export const MAX_SCREENSHOT_LINK_KEYS = 50;

export type ScreenshotLinkMode = 'frame' | 'layer';

export type ScreenshotLinkJob = {
  exportNodeId: string;
  keyIds: string[];
};

export type ScreenshotLinkResultRow = {
  id: string;
  match: { keyId: string } | null;
};

/**
 * Build export→upload jobs for Link screenshots.
 * Frame mode groups matched keys by nearest parent frame id (fallback: layer).
 */
export function buildScreenshotLinkJobs(params: {
  results: ScreenshotLinkResultRow[];
  mode: ScreenshotLinkMode;
  /** layer node id → nearest FRAME id, or null if none */
  frameIdByLayerId: Record<string, string | null>;
  maxKeys?: number;
}): {
  jobs: ScreenshotLinkJob[];
  skippedNoMatch: number;
  matchedCount: number;
  truncated: boolean;
} {
  const maxKeys = params.maxKeys ?? MAX_SCREENSHOT_LINK_KEYS;
  let skippedNoMatch = 0;
  const seenKeyIds = new Set<string>();
  const matched: Array<{ layerId: string; keyId: string }> = [];

  for (const row of params.results) {
    const keyId = row.match?.keyId;
    if (!keyId) {
      skippedNoMatch += 1;
      continue;
    }
    if (seenKeyIds.has(keyId)) continue;
    seenKeyIds.add(keyId);
    matched.push({ layerId: row.id, keyId });
  }

  const truncated = matched.length > maxKeys;
  const capped = matched.slice(0, maxKeys);

  if (params.mode === 'layer') {
    return {
      jobs: capped.map((m) => ({
        exportNodeId: m.layerId,
        keyIds: [m.keyId],
      })),
      skippedNoMatch,
      matchedCount: capped.length,
      truncated,
    };
  }

  // frame mode — group by export node
  const byExport = new Map<string, string[]>();
  for (const m of capped) {
    const frameId = params.frameIdByLayerId[m.layerId];
    const exportNodeId =
      frameId && frameId.length > 0 ? frameId : m.layerId;
    const list = byExport.get(exportNodeId) ?? [];
    list.push(m.keyId);
    byExport.set(exportNodeId, list);
  }

  return {
    jobs: [...byExport.entries()].map(([exportNodeId, keyIds]) => ({
      exportNodeId,
      keyIds,
    })),
    skippedNoMatch,
    matchedCount: capped.length,
    truncated,
  };
}
