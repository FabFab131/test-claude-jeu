// Construit la version « lien » du jeu : un seul fichier HTML autonome (dist/survie.html)
// à publier comme artifact claude.ai. Usage : npm run build:artifact
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (p) => path.join(root, p);

const swapGm = {
  name: 'swap-gm',
  setup(b) {
    b.onResolve({ filter: /^\.\/gm\.js$/ }, (args) =>
      args.importer.endsWith(path.join('public', 'js', 'main.js')) ? { path: r('artifact/gm-artifact.js') } : undefined);
  },
};

const result = await build({
  entryPoints: [r('public/js/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  write: false,
  plugins: [swapGm],
  charset: 'utf8',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const css = await readFile(r('public/style.css'), 'utf8');
const html = await readFile(r('public/index.html'), 'utf8');
const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script[^>]*src=[^>]*><\/script>/g, '')
  .trim();

// Ajustements pour la page publiée : hauteur relative au cadre, marges des encoches.
const artifactCss = `
:root { color-scheme: dark; }
html, body { height: 100%; }
body { background: var(--bg); padding-left: max(0px, env(safe-area-inset-left, 0px)); padding-right: max(0px, env(safe-area-inset-right, 0px)); }
#app { height: 100%; }
@media (max-width: 1000px) {
  #app { height: auto; min-height: 100%; }
  #map-wrap, #panel { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
}
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 3s; } }
`;

const out = `<title>Survie</title>
<style>
${css}
${artifactCss}
</style>
${body}
<script>
${js}
</script>
`;
await mkdir(r('dist'), { recursive: true });
await writeFile(r('dist/survie.html'), out);
console.log(`dist/survie.html — ${(out.length / 1024).toFixed(1)} Ko`);
