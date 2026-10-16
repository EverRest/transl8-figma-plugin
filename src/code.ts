/// <reference types="@figma/plugin-typings" />
import { selectTextLayersForBatch } from './figma/collect-text-layers';
import type {
  CanvasTextUpdate,
  PluginSettings,
  UiToPluginMessage,
} from './messages';

const SETTINGS_KEY = 'transl8.settings';

/** Scan-time originals for Restore / missing-locale fallback. */
const originalById = new Map<string, string>();

figma.showUI(__html__, { width: 420, height: 600 });

async function loadSettings(): Promise<PluginSettings | null> {
  const raw = await figma.clientStorage.getAsync(SETTINGS_KEY);
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as PluginSettings;
  if (!s.apiBaseUrl || !s.projectId || !s.apiKey) return null;
  return s;
}

function walkTextNodes(node: SceneNode, out: TextNode[]) {
  if (node.type === 'TEXT') {
    out.push(node);
    return;
  }
  if ('children' in node) {
    for (const child of node.children) {
      walkTextNodes(child, out);
    }
  }
}

async function loadFontsForTextNode(node: TextNode): Promise<boolean> {
  const fontName = node.fontName;
  if (fontName === figma.mixed) {
    const len = node.characters.length;
    if (len === 0) return true;
    if (typeof node.getRangeAllFontNames === 'function') {
      const fonts = node.getRangeAllFontNames(0, len);
      for (const font of fonts) {
        await figma.loadFontAsync(font);
      }
      return true;
    }
    return false;
  }
  await figma.loadFontAsync(fontName);
  return true;
}

function nearestFrameId(node: BaseNode): string | null {
  let current: BaseNode | null = node.parent;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if (current.type === 'FRAME') {
      return current.id;
    }
    current = current.parent;
  }
  return null;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function exportNodesPng(
  nodeIds: string[],
): Promise<{
  exports: Array<{ nodeId: string; pngBase64: string }>;
  skipped: number;
}> {
  const exports: Array<{ nodeId: string; pngBase64: string }> = [];
  let skipped = 0;
  for (const nodeId of nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || !('exportAsync' in node)) {
      skipped += 1;
      continue;
    }
    try {
      const bytes = await (node as SceneNode).exportAsync({ format: 'PNG' });
      exports.push({ nodeId, pngBase64: uint8ToBase64(bytes) });
    } catch {
      skipped += 1;
    }
  }
  return { exports, skipped };
}

async function applyUpdates(
  updates: CanvasTextUpdate[],
): Promise<{ applied: number; skipped: number }> {
  let applied = 0;
  let skipped = 0;
  for (const update of updates) {
    const node = await figma.getNodeByIdAsync(update.id);
    if (!node || node.type !== 'TEXT') {
      skipped += 1;
      continue;
    }
    try {
      const ok = await loadFontsForTextNode(node);
      if (!ok) {
        skipped += 1;
        continue;
      }
      node.characters = update.text;
      applied += 1;
    } catch {
      skipped += 1;
    }
  }
  return { applied, skipped };
}

figma.ui.onmessage = async (msg: UiToPluginMessage) => {
  try {
    if (msg.type === 'READY') {
      const settings = await loadSettings();
      figma.ui.postMessage({ type: 'SETTINGS', settings });
      return;
    }

    if (msg.type === 'SAVE_SETTINGS') {
      await figma.clientStorage.setAsync(SETTINGS_KEY, msg.settings);
      figma.notify('transl8.ai settings saved');
      figma.ui.postMessage({ type: 'SETTINGS', settings: msg.settings });
      return;
    }

    if (msg.type === 'SCAN_PAGE') {
      const textNodes: TextNode[] = [];
      for (const child of figma.currentPage.children) {
        walkTextNodes(child, textNodes);
      }
      originalById.clear();
      const layers = textNodes.map((n) => {
        originalById.set(n.id, n.characters);
        return {
          id: n.id,
          name: n.name,
          text: n.characters,
          parentFrameId: nearestFrameId(n),
        };
      });
      const selected = selectTextLayersForBatch(layers);
      figma.ui.postMessage({
        type: 'SCAN_LAYERS',
        items: selected.items,
        totalFound: selected.totalFound,
        truncated: selected.truncated,
      });
      return;
    }

    if (msg.type === 'APPLY_TO_CANVAS') {
      const { applied, skipped } = await applyUpdates(msg.updates);
      figma.notify(
        `Applied ${applied} layer(s)` + (skipped ? `, skipped ${skipped}` : ''),
      );
      figma.ui.postMessage({ type: 'APPLY_RESULT', applied, skipped });
      return;
    }

    if (msg.type === 'RESTORE_ORIGINALS') {
      const updates: CanvasTextUpdate[] = [...originalById.entries()].map(
        ([id, text]) => ({ id, text }),
      );
      const { applied, skipped } = await applyUpdates(updates);
      figma.notify(
        `Restored ${applied} original(s)` +
          (skipped ? `, skipped ${skipped}` : ''),
      );
      figma.ui.postMessage({
        type: 'APPLY_RESULT',
        applied,
        skipped,
        restored: true,
      });
      return;
    }

    if (msg.type === 'EXPORT_NODES') {
      const { exports, skipped } = await exportNodesPng(msg.nodeIds);
      figma.ui.postMessage({ type: 'EXPORT_RESULT', exports, skipped });
    }
  } catch (error) {
    figma.ui.postMessage({
      type: 'ERROR',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
