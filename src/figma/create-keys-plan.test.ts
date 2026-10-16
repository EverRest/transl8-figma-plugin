import { describe, expect, it } from 'vitest';
import { buildCreateKeysPlan } from './create-keys-plan';

describe('buildCreateKeysPlan', () => {
  it('creates a key for an unmatched row with a proposal', () => {
    const plan = buildCreateKeysPlan(
      [{ id: '1', match: null, proposedKeyName: 'checkout.submit' }],
      { '1': 'Submit' },
    );

    expect(plan.items).toEqual([{ key: 'checkout.submit', sourceText: 'Submit' }]);
    expect(plan.skippedAlreadyMatched).toBe(0);
    expect(plan.skippedNoProposal).toBe(0);
  });

  it('skips a row that already matched an existing key', () => {
    const plan = buildCreateKeysPlan(
      [{ id: '1', match: { keyId: 'k1' }, proposedKeyName: 'ignored' }],
      { '1': 'Submit' },
    );

    expect(plan.items).toEqual([]);
    expect(plan.skippedAlreadyMatched).toBe(1);
  });

  it('skips a row with no proposed key name', () => {
    const plan = buildCreateKeysPlan(
      [{ id: '1', match: null, proposedKeyName: null }],
      { '1': 'Submit' },
    );

    expect(plan.items).toEqual([]);
    expect(plan.skippedNoProposal).toBe(1);
  });

  it('dedupes two rows proposing the same key name, keeping the first', () => {
    const plan = buildCreateKeysPlan(
      [
        { id: '1', match: null, proposedKeyName: 'checkout.submit' },
        { id: '2', match: null, proposedKeyName: 'checkout.submit' },
      ],
      { '1': 'Submit', '2': 'Submit now' },
    );

    expect(plan.items).toEqual([{ key: 'checkout.submit', sourceText: 'Submit' }]);
    expect(plan.skippedDuplicate).toBe(1);
  });

  it('skips a row with no source text rather than sending an empty string (backend requires non-empty)', () => {
    const plan = buildCreateKeysPlan(
      [{ id: '1', match: null, proposedKeyName: 'checkout.submit' }],
      {},
    );

    expect(plan.items).toEqual([]);
    expect(plan.skippedNoSourceText).toBe(1);
  });

  it('trims whitespace-only proposals and source text as absent', () => {
    const plan = buildCreateKeysPlan(
      [{ id: '1', match: null, proposedKeyName: '   ' }],
      { '1': '   ' },
    );

    expect(plan.items).toEqual([]);
    expect(plan.skippedNoProposal).toBe(1);
  });

  it('builds a plan for a mix of matched, proposed, and duplicate rows', () => {
    const plan = buildCreateKeysPlan(
      [
        { id: '1', match: { keyId: 'k1' }, proposedKeyName: null },
        { id: '2', match: null, proposedKeyName: 'a.b' },
        { id: '3', match: null, proposedKeyName: 'a.b' },
        { id: '4', match: null, proposedKeyName: 'c.d' },
        { id: '5', match: null, proposedKeyName: null },
      ],
      { '2': 'A', '3': 'A dup', '4': 'C' },
    );

    expect(plan.items).toEqual([
      { key: 'a.b', sourceText: 'A' },
      { key: 'c.d', sourceText: 'C' },
    ]);
    expect(plan.skippedAlreadyMatched).toBe(1);
    expect(plan.skippedDuplicate).toBe(1);
    expect(plan.skippedNoProposal).toBe(1);
  });
});
