import type { CollectedTextLayer } from './figma/collect-text-layers';

export type PluginSettings = {
  apiBaseUrl: string;
  projectId: string;
  apiKey: string;
};

/** Nothing is preset: the user supplies the host, project and key. */
export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  apiBaseUrl: '',
  projectId: '',
  apiKey: '',
};

export type CanvasTextUpdate = {
  id: string;
  text: string;
};

export type PluginToUiMessage =
  | { type: 'SETTINGS'; settings: PluginSettings | null }
  | {
      type: 'SCAN_LAYERS';
      items: CollectedTextLayer[];
      totalFound: number;
      truncated: boolean;
    }
  | {
      type: 'APPLY_RESULT';
      applied: number;
      skipped: number;
      restored?: boolean;
    }
  | {
      type: 'EXPORT_RESULT';
      exports: Array<{ nodeId: string; pngBase64: string }>;
      skipped: number;
    }
  | { type: 'ERROR'; message: string };

export type UiToPluginMessage =
  | { type: 'READY' }
  | { type: 'SAVE_SETTINGS'; settings: PluginSettings }
  | { type: 'SCAN_PAGE' }
  | { type: 'APPLY_TO_CANVAS'; updates: CanvasTextUpdate[] }
  | { type: 'RESTORE_ORIGINALS' }
  | { type: 'EXPORT_NODES'; nodeIds: string[] };
