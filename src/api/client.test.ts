import { afterEach, describe, expect, it, vi } from 'vitest';
import { bulkImportKeys } from './client';

describe('bulkImportKeys', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /projects/:id/keys/bulk-import with the keys and auth header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { created: 2, total: 2 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await bulkImportKeys({
      apiBaseUrl: 'https://api.example.com',
      projectId: 'proj_1',
      apiKey: 'ta_live_x',
      keys: [{ key: 'a.b', sourceText: 'A' }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/projects/proj_1/keys/bulk-import',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer ta_live_x' }),
        body: JSON.stringify({ keys: [{ key: 'a.b', sourceText: 'A' }] }),
      }),
    );
    expect(result).toEqual({ created: 2, total: 2 });
  });

  it('throws with the server message on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, message: 'Project not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      bulkImportKeys({
        apiBaseUrl: 'https://api.example.com',
        projectId: 'missing',
        apiKey: 'ta_live_x',
        keys: [],
      }),
    ).rejects.toThrow('Project not found');
  });
});
