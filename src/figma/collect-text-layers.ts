export const FIGMA_PLUGIN_BATCH_MAX = 200;

export type CollectedTextLayer = {
  id: string;
  name: string;
  text: string;
  /** Nearest ancestor FRAME id, if any (for screenshot linkage). */
  parentFrameId?: string | null;
};

export type CollectTextLayersResult = {
  items: CollectedTextLayer[];
  totalFound: number;
  truncated: boolean;
};

/** Pure helper — pass already-walked text nodes from the Figma main thread. */
export function selectTextLayersForBatch(
  layers: CollectedTextLayer[],
  maxItems = FIGMA_PLUGIN_BATCH_MAX,
): CollectTextLayersResult {
  const nonEmpty = layers.filter((l) => l.text.trim().length > 0);
  const totalFound = nonEmpty.length;
  const items = nonEmpty.slice(0, maxItems);
  return {
    items,
    totalFound,
    truncated: totalFound > maxItems,
  };
}
