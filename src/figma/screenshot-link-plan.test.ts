import { describe, expect, it } from 'vitest';
import {
  MAX_SCREENSHOT_LINK_KEYS,
  buildScreenshotLinkJobs,
  type ScreenshotLinkMode,
} from './screenshot-link-plan';

type Row = {
  id: string;
  match: { keyId: string } | null;
};

function row(id: string, keyId: string | null): Row {
  return { id, match: keyId ? { keyId } : null };
}

describe('buildScreenshotLinkJobs', () => {
  it('skips unmatched / propose-only rows', () => {
    const { jobs, skippedNoMatch } = buildScreenshotLinkJobs({
      results: [row('a', null), row('b', 'k1')],
      mode: 'layer',
      frameIdByLayerId: {},
    });
    expect(skippedNoMatch).toBe(1);
    expect(jobs).toEqual([{ exportNodeId: 'b', keyIds: ['k1'] }]);
  });

  it('layer mode: one job per key/layer', () => {
    const { jobs } = buildScreenshotLinkJobs({
      results: [row('a', 'k1'), row('b', 'k2')],
      mode: 'layer',
      frameIdByLayerId: { a: 'frame1', b: 'frame1' },
    });
    expect(jobs).toEqual([
      { exportNodeId: 'a', keyIds: ['k1'] },
      { exportNodeId: 'b', keyIds: ['k2'] },
    ]);
  });

  it('frame mode: groups keys sharing a frame into one export', () => {
    const { jobs } = buildScreenshotLinkJobs({
      results: [row('a', 'k1'), row('b', 'k2'), row('c', 'k3')],
      mode: 'frame',
      frameIdByLayerId: { a: 'F1', b: 'F1', c: 'F2' },
    });
    expect(jobs).toEqual([
      { exportNodeId: 'F1', keyIds: ['k1', 'k2'] },
      { exportNodeId: 'F2', keyIds: ['k3'] },
    ]);
  });

  it('frame mode: falls back to layer id when no frame', () => {
    const { jobs } = buildScreenshotLinkJobs({
      results: [row('a', 'k1')],
      mode: 'frame',
      frameIdByLayerId: { a: null },
    });
    expect(jobs).toEqual([{ exportNodeId: 'a', keyIds: ['k1'] }]);
  });

  it('caps at MAX_SCREENSHOT_LINK_KEYS and sets truncated', () => {
    const results = Array.from({ length: MAX_SCREENSHOT_LINK_KEYS + 5 }, (_, i) =>
      row(`n${i}`, `k${i}`),
    );
    const { jobs, truncated, matchedCount } = buildScreenshotLinkJobs({
      results,
      mode: 'layer',
      frameIdByLayerId: {},
    });
    expect(matchedCount).toBe(MAX_SCREENSHOT_LINK_KEYS);
    expect(truncated).toBe(true);
    expect(jobs.reduce((n, j) => n + j.keyIds.length, 0)).toBe(
      MAX_SCREENSHOT_LINK_KEYS,
    );
  });

  it('dedupes the same keyId appearing twice (keeps first export)', () => {
    const { jobs } = buildScreenshotLinkJobs({
      results: [row('a', 'k1'), row('b', 'k1')],
      mode: 'layer' as ScreenshotLinkMode,
      frameIdByLayerId: {},
    });
    expect(jobs).toEqual([{ exportNodeId: 'a', keyIds: ['k1'] }]);
  });
});
