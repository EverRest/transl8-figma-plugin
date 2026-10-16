import { describe, expect, it } from 'vitest';
import { DEFAULT_PLUGIN_SETTINGS } from './messages';

describe('DEFAULT_PLUGIN_SETTINGS', () => {
  it('ships with no host, project or key preset', () => {
    expect(DEFAULT_PLUGIN_SETTINGS).toEqual({ apiBaseUrl: '', projectId: '', apiKey: '' });
  });
});
