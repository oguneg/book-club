// Bundles the server and its dependencies into one file, so the production image needs no node_modules.
import { builtinModules } from 'node:module';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  legalComments: 'none',
  metafile: true,
  // Dev-only embedded database and its Drizzle adapter: imported lazily, never loaded in production.
  external: ['@electric-sql/pglite', 'drizzle-orm/pglite', 'drizzle-orm/pglite/*'],
  // Some dependencies are CommonJS and call require().
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});

// The runtime image has no node_modules: a static import of anything but a Node built-in would crash at start.
const builtins = new Set(builtinModules);
const staticExternals = Object.values(result.metafile.outputs)
  .flatMap((output) => output.imports)
  .filter((imp) => imp.external && imp.kind === 'import-statement')
  .map((imp) => imp.path)
  .filter((path) => !path.startsWith('node:') && !builtins.has(path));
if (staticExternals.length > 0) {
  console.error(`Bundle statically imports packages missing at runtime: ${[...new Set(staticExternals)].join(', ')}`);
  process.exit(1);
}
