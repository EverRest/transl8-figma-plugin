import * as esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'src/code.ts')],
  bundle: true,
  outfile: join(dist, 'code.js'),
  target: 'es2017',
  format: 'iife',
  logLevel: 'info',
});

await esbuild.build({
  entryPoints: [join(root, 'src/ui.ts')],
  bundle: true,
  outfile: join(dist, 'ui.js'),
  target: 'es2017',
  format: 'iife',
  logLevel: 'info',
});

const uiJs = readFileSync(join(dist, 'ui.js'), 'utf8');
const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>transl8.ai</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; font-size: 12px; }
      body { margin: 0; padding: 12px; }
      h1 { font-size: 14px; margin: 0 0 8px; }
      label { display: block; margin: 6px 0 2px; opacity: 0.8; }
      input, select, button { width: 100%; box-sizing: border-box; padding: 6px 8px; margin-bottom: 6px; }
      button { cursor: pointer; }
      .row { display: flex; gap: 8px; }
      .row > * { flex: 1; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid rgba(127,127,127,0.3); vertical-align: top; word-break: break-word; }
      tr.at-risk { background: rgba(220, 80, 60, 0.12); }
      .warn { color: #b45309; margin: 6px 0; }
      .err { color: #b91c1c; margin: 6px 0; }
      .muted { opacity: 0.65; }
      #results-wrap { max-height: 360px; overflow: auto; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>${uiJs}</script>
  </body>
</html>
`;
writeFileSync(join(dist, 'ui.html'), html);
console.log('Built dist');
