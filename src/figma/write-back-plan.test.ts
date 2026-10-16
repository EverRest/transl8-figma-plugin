import { describe, expect, it } from 'vitest';
import { buildWriteBackUpdates } from './write-back-plan';

describe('buildWriteBackUpdates', () => {
  it('uses resolvedValue when present', () => {
    expect(
      buildWriteBackUpdates(
        [{ id: '1', resolvedValue: 'Abbrechen' }],
        { '1': 'Cancel' },
      ),
    ).toEqual([{ id: '1', text: 'Abbrechen' }]);
  });

  it('falls back to original when resolvedValue is missing', () => {
    expect(
      buildWriteBackUpdates(
        [
          { id: '1', resolvedValue: null },
          { id: '2', resolvedValue: '  ' },
        ],
        { '1': 'Cancel', '2': 'Save' },
      ),
    ).toEqual([
      { id: '1', text: 'Cancel' },
      { id: '2', text: 'Save' },
    ]);
  });

  it('skips ids with no resolved value and no original', () => {
    expect(
      buildWriteBackUpdates([{ id: 'x', resolvedValue: null }], {}),
    ).toEqual([]);
  });
});
