export type BatchResolveItem = {
  id: string;
  text: string;
  contentType?: string;
};

export type BatchResolveResult = {
  id: string;
  match: { keyId: string; sourceText: string; confidence: number } | null;
  proposedKeyName: string | null;
  resolvedValue: string | null;
  translationStatus: string | null;
  overflow: { atRisk: boolean; reason?: string } | null;
};

export type FigmaMeta = {
  languages: Array<{ code: string; isDefault: boolean }>;
};

type ApiSuccess<T> = { success: true; data: T };

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiSuccess<T> & { message?: string };
  if (!res.ok) {
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data;
  }
  return body as T;
}

export async function fetchFigmaMeta(opts: {
  apiBaseUrl: string;
  projectId: string;
  apiKey: string;
}): Promise<FigmaMeta> {
  const res = await fetch(
    joinUrl(opts.apiBaseUrl, `/api/v1/projects/${opts.projectId}/figma/meta`),
    {
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        Accept: 'application/json',
      },
    },
  );
  return parseJson<FigmaMeta>(res);
}

export async function resolveBatch(opts: {
  apiBaseUrl: string;
  projectId: string;
  apiKey: string;
  locale: string;
  items: BatchResolveItem[];
}): Promise<BatchResolveResult[]> {
  const res = await fetch(
    joinUrl(
      opts.apiBaseUrl,
      `/api/v1/projects/${opts.projectId}/figma/resolve-batch`,
    ),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locale: opts.locale,
        items: opts.items,
      }),
    },
  );
  return parseJson<BatchResolveResult[]>(res);
}

const KEY_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

export async function uploadKeyScreenshot(opts: {
  apiBaseUrl: string;
  projectId: string;
  apiKey: string;
  keyId: string;
  bytes: Uint8Array;
  filename: string;
}): Promise<void> {
  if (opts.bytes.byteLength > KEY_SCREENSHOT_MAX_BYTES) {
    throw new Error(
      `Screenshot exceeds 5 MiB (${opts.bytes.byteLength} bytes)`,
    );
  }
  const form = new FormData();
  const copy = new Uint8Array(opts.bytes.byteLength);
  copy.set(opts.bytes);
  form.append('file', new Blob([copy], { type: 'image/png' }), opts.filename);
  const res = await fetch(
    joinUrl(
      opts.apiBaseUrl,
      `/api/v1/projects/${opts.projectId}/keys/${opts.keyId}/screenshot`,
    ),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        Accept: 'application/json',
      },
      body: form,
    },
  );
  await parseJson<unknown>(res);
}

/** Mirrors the backend's bulk-import keys response body. */
export type BulkImportKeysResult = {
  created: number;
  total: number;
};

/**
 * Wraps `POST /projects/:id/keys/bulk-import` (already used
 * elsewhere; see `create-keys-plan.ts` for how the request body is built).
 * The backend upserts by key name, so this is safe to call with a name that
 * already exists.
 */
export async function bulkImportKeys(opts: {
  apiBaseUrl: string;
  projectId: string;
  apiKey: string;
  keys: Array<{ key: string; sourceText: string }>;
}): Promise<BulkImportKeysResult> {
  const res = await fetch(
    joinUrl(opts.apiBaseUrl, `/api/v1/projects/${opts.projectId}/keys/bulk-import`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keys: opts.keys }),
    },
  );
  return parseJson<BulkImportKeysResult>(res);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
