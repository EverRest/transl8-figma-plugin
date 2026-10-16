import {
  base64ToUint8Array,
  bulkImportKeys,
  fetchFigmaMeta,
  resolveBatch,
  uploadKeyScreenshot,
  type BatchResolveResult,
} from './api/client';
import { buildCreateKeysPlan } from './figma/create-keys-plan';
import type { CollectedTextLayer } from './figma/collect-text-layers';
import {
  buildScreenshotLinkJobs,
  type ScreenshotLinkMode,
} from './figma/screenshot-link-plan';
import { buildWriteBackUpdates } from './figma/write-back-plan';
import {
  DEFAULT_PLUGIN_SETTINGS,
  type PluginSettings,
  type PluginToUiMessage,
} from './messages';

const root = document.getElementById('app')!;

let settings: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
let languages: Array<{ code: string; isDefault: boolean }> = [];
let locale = '';
let lastLayers: CollectedTextLayer[] = [];
let results: BatchResolveResult[] = [];
let truncated = false;
let totalFound = 0;
let status = '';
let error = '';
let busy = false;
let autoApply = true;
let screenshotMode: ScreenshotLinkMode = 'frame';

type ExportWaiter = {
  resolve: (value: {
    exports: Array<{ nodeId: string; pngBase64: string }>;
    skipped: number;
  }) => void;
  reject: (reason: Error) => void;
};
let exportWaiter: ExportWaiter | null = null;

function postToPlugin(msg: unknown) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

function originalsMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const layer of lastLayers) {
    out[layer.id] = layer.text;
  }
  return out;
}

function matchedKeyCount(): number {
  return results.filter((r) => r.match?.keyId).length;
}

/** How many rows a "Create keys" click would actually create; used both to render the button label and to gate it. */
function createKeysCount(): number {
  return buildCreateKeysPlan(results, originalsMap()).items.length;
}

function sendApplyFromResults(batch: BatchResolveResult[]) {
  const updates = buildWriteBackUpdates(
    batch.map((r) => ({ id: r.id, resolvedValue: r.resolvedValue })),
    originalsMap(),
  );
  if (updates.length === 0) {
    status = 'Nothing to apply';
    render();
    return;
  }
  postToPlugin({ type: 'APPLY_TO_CANVAS', updates });
}

function requestExports(
  nodeIds: string[],
): Promise<{
  exports: Array<{ nodeId: string; pngBase64: string }>;
  skipped: number;
}> {
  return new Promise((resolve, reject) => {
    exportWaiter = { resolve, reject };
    postToPlugin({ type: 'EXPORT_NODES', nodeIds });
  });
}

async function linkScreenshots() {
  const frameIdByLayerId: Record<string, string | null> = {};
  for (const layer of lastLayers) {
    frameIdByLayerId[layer.id] = layer.parentFrameId ?? null;
  }
  const plan = buildScreenshotLinkJobs({
    results,
    mode: screenshotMode,
    frameIdByLayerId,
  });
  if (plan.jobs.length === 0) {
    status = `No matched keys to link (${plan.skippedNoMatch} unmatched)`;
    render();
    return;
  }

  busy = true;
  error = '';
  status = `Exporting ${plan.jobs.length} node(s)…`;
  render();

  try {
    const nodeIds = plan.jobs.map((j) => j.exportNodeId);
    const { exports, skipped: exportSkipped } = await requestExports(nodeIds);
    const byNode = new Map(exports.map((e) => [e.nodeId, e.pngBase64]));

    let linked = 0;
    let failed = 0;
    let skippedOversize = 0;

    for (const job of plan.jobs) {
      const b64 = byNode.get(job.exportNodeId);
      if (!b64) {
        failed += job.keyIds.length;
        continue;
      }
      const bytes = base64ToUint8Array(b64);
      for (const keyId of job.keyIds) {
        try {
          await uploadKeyScreenshot({
            ...settings,
            keyId,
            bytes,
            filename: `figma-${job.exportNodeId}.png`,
          });
          linked += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('5 MiB')) {
            skippedOversize += 1;
          } else {
            failed += 1;
          }
        }
      }
    }

    status =
      `Linked ${linked}` +
      (plan.skippedNoMatch ? ` · skipped unmatched ${plan.skippedNoMatch}` : '') +
      (exportSkipped ? ` · export skipped ${exportSkipped}` : '') +
      (skippedOversize ? ` · oversize ${skippedOversize}` : '') +
      (failed ? ` · failed ${failed}` : '') +
      (plan.truncated ? ` · capped at ${plan.matchedCount}` : '');
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    busy = false;
    render();
  }
}

/**
 * `proposedKeyName` used to be display-only (see create-keys-plan.ts's
 * doc comment); this is what turns it into a real key via the same
 * bulk-import route the dashboard already uses.
 */
async function createKeys() {
  const plan = buildCreateKeysPlan(results, originalsMap());
  if (plan.items.length === 0) {
    status = 'No proposed keys to create';
    render();
    return;
  }

  busy = true;
  error = '';
  status = `Creating ${plan.items.length} key(s)…`;
  render();

  try {
    const result = await bulkImportKeys({ ...settings, keys: plan.items });
    status =
      `Created ${result.created} key(s)` +
      (plan.skippedDuplicate ? ` · duplicate proposals ${plan.skippedDuplicate}` : '') +
      ' · re-scan to see them matched';
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    busy = false;
    render();
  }
}

function render() {
  const langOptions =
    languages.length > 0
      ? languages
          .map(
            (l) =>
              `<option value="${escapeHtml(l.code)}" ${
                l.code === locale ? 'selected' : ''
              }>${escapeHtml(l.code)}${l.isDefault ? ' (default)' : ''}</option>`,
          )
          .join('')
      : `<option value="">Load meta after saving settings</option>`;

  const rows = results
    .map((r) => {
      const layer = lastLayers.find((l) => l.id === r.id);
      const keyLabel = r.match
        ? escapeHtml(r.match.sourceText)
        : r.proposedKeyName
          ? `propose: ${escapeHtml(r.proposedKeyName)}`
          : '—';
      const overflow = r.overflow?.atRisk ? 'yes' : '—';
      const cls = r.overflow?.atRisk ? 'at-risk' : '';
      return `<tr class="${cls}">
        <td>${escapeHtml(layer?.name ?? r.id)}<div class="muted">${escapeHtml(
          layer?.text ?? '',
        )}</div></td>
        <td>${keyLabel}</td>
        <td>${escapeHtml(r.resolvedValue ?? '—')}<div class="muted">${escapeHtml(
          r.translationStatus ?? 'missing',
        )}</div></td>
        <td>${overflow}</td>
      </tr>`;
    })
    .join('');

  const canApply = results.length > 0 && !busy;
  const canRestore = lastLayers.length > 0 && !busy;
  const canLink = matchedKeyCount() > 0 && !busy;
  const createCount = createKeysCount();
  const canCreateKeys = createCount > 0 && !busy;

  root.innerHTML = `
    <h1>transl8.ai</h1>
    <p class="muted">Preview locales on the canvas. Link screenshots to matched keys for reviewers.</p>

    <label>API base URL</label>
    <input id="apiBaseUrl" placeholder="https://your-transl8-host" value="${escapeAttr(settings.apiBaseUrl)}" />
    <label>Project ID</label>
    <input id="projectId" value="${escapeAttr(settings.projectId)}" />
    <label>Project API key</label>
    <input id="apiKey" type="password" value="${escapeAttr(settings.apiKey)}" />
    <button id="save">Save settings</button>

    <div class="row">
      <div>
        <label>Locale</label>
        <select id="locale">${langOptions}</select>
      </div>
      <div style="align-self:end">
        <button id="scan" ${busy ? 'disabled' : ''}>${
          busy ? 'Scanning…' : 'Scan page'
        }</button>
      </div>
    </div>

    <label style="display:flex;align-items:center;gap:6px;margin:8px 0">
      <input id="autoApply" type="checkbox" ${autoApply ? 'checked' : ''} style="width:auto;margin:0" />
      Auto-apply to canvas after resolve
    </label>

    <div class="row">
      <button id="apply" ${canApply ? '' : 'disabled'}>Apply to canvas</button>
      <button id="restore" ${canRestore ? '' : 'disabled'}>Restore originals</button>
    </div>

    <button id="createKeys" ${canCreateKeys ? '' : 'disabled'} style="margin-top:8px">
      Create ${createCount} key${createCount === 1 ? '' : 's'}
    </button>

    <label>Screenshot crop</label>
    <select id="screenshotMode">
      <option value="frame" ${screenshotMode === 'frame' ? 'selected' : ''}>Frame (default)</option>
      <option value="layer" ${screenshotMode === 'layer' ? 'selected' : ''}>Layer crop</option>
    </select>
    <button id="linkScreenshots" ${canLink ? '' : 'disabled'} style="margin-top:8px">
      Link screenshots
    </button>

    ${truncated ? `<p class="warn">Showing 200 of ${totalFound} layers</p>` : ''}
    ${status ? `<p class="muted">${escapeHtml(status)}</p>` : ''}
    ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}

    <div id="results-wrap">
      <table>
        <thead>
          <tr><th>Layer</th><th>Key</th><th>Resolved</th><th>Overflow</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" class="muted">No results yet</td></tr>'}</tbody>
      </table>
    </div>
  `;

  document.getElementById('save')!.onclick = () => {
    settings = {
      apiBaseUrl: (document.getElementById('apiBaseUrl') as HTMLInputElement)
        .value.trim(),
      projectId: (document.getElementById('projectId') as HTMLInputElement)
        .value.trim(),
      apiKey: (document.getElementById('apiKey') as HTMLInputElement).value.trim(),
    };
    postToPlugin({ type: 'SAVE_SETTINGS', settings });
    void refreshMeta();
  };

  document.getElementById('scan')!.onclick = () => {
    error = '';
    readLocaleFromDom();
    postToPlugin({ type: 'SCAN_PAGE' });
  };

  document.getElementById('autoApply')!.onchange = (ev) => {
    autoApply = (ev.target as HTMLInputElement).checked;
  };

  document.getElementById('screenshotMode')!.onchange = (ev) => {
    screenshotMode = (ev.target as HTMLSelectElement)
      .value as ScreenshotLinkMode;
  };

  document.getElementById('apply')!.onclick = () => {
    sendApplyFromResults(results);
  };

  document.getElementById('restore')!.onclick = () => {
    postToPlugin({ type: 'RESTORE_ORIGINALS' });
  };

  document.getElementById('linkScreenshots')!.onclick = () => {
    void linkScreenshots();
  };

  document.getElementById('createKeys')!.onclick = () => {
    void createKeys();
  };

  const localeEl = document.getElementById('locale') as HTMLSelectElement;
  localeEl.onchange = () => {
    locale = localeEl.value;
    if (lastLayers.length > 0) {
      void runResolve(lastLayers);
    }
  };
}

function readLocaleFromDom() {
  const localeEl = document.getElementById('locale') as HTMLSelectElement | null;
  if (localeEl?.value) locale = localeEl.value;
}

async function refreshMeta() {
  if (!settings.apiBaseUrl || !settings.projectId || !settings.apiKey) return;
  try {
    const meta = await fetchFigmaMeta(settings);
    languages = meta.languages;
    if (!locale) {
      locale =
        languages.find((l) => l.isDefault)?.code ?? languages[0]?.code ?? '';
    }
    status = `Loaded ${languages.length} language(s)`;
    error = '';
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  render();
}

async function runResolve(items: CollectedTextLayer[]) {
  if (!settings.apiBaseUrl || !settings.projectId || !settings.apiKey) return;
  if (!locale) {
    error = 'Select a locale first (save settings to load languages)';
    render();
    return;
  }
  busy = true;
  error = '';
  status = `Resolving ${items.length} layer(s)…`;
  render();
  try {
    // Always resolve against scan-time source text (lastLayers), not canvas.
    results = await resolveBatch({
      ...settings,
      locale,
      items: items.map((i) => ({ id: i.id, text: i.text })),
    });
    status = `Resolved ${results.length} layer(s) for ${locale}`;
    if (autoApply) {
      sendApplyFromResults(results);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    busy = false;
    render();
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as PluginToUiMessage | undefined;
  if (!msg) return;

  if (msg.type === 'SETTINGS') {
    if (msg.settings) settings = msg.settings;
    void refreshMeta();
    render();
    return;
  }

  if (msg.type === 'SCAN_LAYERS') {
    lastLayers = msg.items;
    truncated = msg.truncated;
    totalFound = msg.totalFound;
    void runResolve(msg.items);
    return;
  }

  if (msg.type === 'APPLY_RESULT') {
    status = msg.restored
      ? `Restored ${msg.applied} original(s)` +
        (msg.skipped ? `, skipped ${msg.skipped}` : '')
      : `Applied ${msg.applied} layer(s)` +
        (msg.skipped ? `, skipped ${msg.skipped}` : '');
    render();
    return;
  }

  if (msg.type === 'EXPORT_RESULT') {
    if (exportWaiter) {
      exportWaiter.resolve({
        exports: msg.exports,
        skipped: msg.skipped,
      });
      exportWaiter = null;
    }
    return;
  }

  if (msg.type === 'ERROR') {
    if (exportWaiter) {
      exportWaiter.reject(new Error(msg.message));
      exportWaiter = null;
    }
    error = msg.message;
    busy = false;
    render();
  }
};

render();
postToPlugin({ type: 'READY' });
