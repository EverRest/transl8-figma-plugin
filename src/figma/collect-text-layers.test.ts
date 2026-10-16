import { describe, expect, it } from 'vitest';
import {
  FIGMA_PLUGIN_BATCH_MAX,
  selectTextLayersForBatch,
} from './collect-text-layers';

describe('selectTextLayersForBatch', () => {
  it('drops empty/whitespace text and preserves order', () => {
    const result = selectTextLayersForBatch([
      { id: '1', name: 'a', text: '  ' },
      { id: '2', name: 'b', text: 'Hello' },
      { id: '3', name: 'c', text: '' },
      { id: '4', name: 'd', text: 'World' },
    ]);
    expect(result.totalFound).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.items.map((i) => i.id)).toEqual(['2', '4']);
  });

  it('truncates at the batch max and flags truncated', () => {
    const layers = Array.from({ length: FIGMA_PLUGIN_BATCH_MAX + 3 }, (_, i) => ({
      id: String(i),
      name: `n${i}`,
      text: `Label ${i}`,
    }));
    const result = selectTextLayersForBatch(layers);
    expect(result.items).toHaveLength(FIGMA_PLUGIN_BATCH_MAX);
    expect(result.totalFound).toBe(FIGMA_PLUGIN_BATCH_MAX + 3);
    expect(result.truncated).toBe(true);
  });
});
