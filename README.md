# transl8.ai Figma plugin

Scan the **current page**’s text layers, resolve via transl8.ai batch API,
**preview locales on the canvas** (auto-apply + Restore originals), and
**link screenshots** to matched keys for reviewers.

## Setup

```bash
npm install
npm run build
```

This writes `dist/code.js` and `dist/ui.html`.

## Load in Figma Desktop

1. Plugins → Development → Import plugin from manifest…
2. Select `manifest.json` from this repository
3. Create a **project API key** in transl8.ai
4. In the plugin, set the **API base URL** (the address of your transl8.ai
   server, for example `https://api.example.com`), the **project ID** and the
   **API key** → Save → Scan page. There is no default URL: the plugin sends
   no request until you set one.
5. Switch locale (auto-applies by default) or use **Apply to canvas** /
   **Restore originals**
6. After resolve: choose Frame/Layer crop → **Link screenshots** (matched
   keys only)

## Behaviour

- Resolve always uses **scan-time source text** (not the current canvas string)
- Missing translations → restore that layer’s original snapshot
- Mixed-font layers may be skipped if fonts cannot be loaded
- Screenshot link overwrites any existing key screenshot (same as dashboard upload)

## Limits

- Max **200** text layers per scan
- Max **50** matched keys per Link screenshots click
- PNG only; files over **5 MiB** are skipped
- Full project API key **or** a key with the **Figma plugin** route allowlist
  (Project Settings → API keys → Figma plugin chip)

## Scripts

- `npm test` — unit tests (layer selection + write-back + screenshot plan)
- `npm run build` — writes `dist/code.js` + `dist/ui.html`

## License

[MIT](LICENSE)
