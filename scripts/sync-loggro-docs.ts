/**
 * Sincroniza la documentación oficial de Loggro (https://developer.loggro.com)
 * y regenera el inventario de endpoints en docs/loggro-api/inventory/.
 *
 * Uso:
 *   npm run docs:sync                      # descarga y regenera
 *   npm run docs:sync -- --offline         # regenera desde .cache/loggro-docs
 *
 * Detrás de un proxy HTTP, ejecutar con NODE_USE_ENV_PROXY=1.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DOCS_ORIGIN,
  INDEX_URL,
  classify,
  extractOperations,
  parseIndex,
  productFile,
  renderIndex,
  renderProduct,
  type IndexedPage,
  type Operation,
} from './lib/loggro-docs.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'loggro-docs');
const PAGES_DIR = path.join(CACHE_DIR, 'pages');
const OUT_DIR = path.join(ROOT, 'docs', 'loggro-api', 'inventory');
const CONCURRENCY = 4;
const OFFLINE = process.argv.includes('--offline');

async function fetchText(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 3) throw new Error(`No se pudo descargar ${url}`, { cause: err });
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}

async function downloadPages(pages: IndexedPage[]): Promise<void> {
  let next = 0;
  let done = 0;
  const lane = async (): Promise<void> => {
    for (let page = pages[next++]; page; page = pages[next++]) {
      const md = await fetchText(`${DOCS_ORIGIN}/reference/${page.slug}.md`);
      await writeFile(path.join(PAGES_DIR, `${page.slug}.md`), md);
      if (++done % 50 === 0) console.error(`… ${done}/${pages.length} páginas`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, lane));
}

async function main(): Promise<void> {
  await mkdir(PAGES_DIR, { recursive: true });
  const indexPath = path.join(CACHE_DIR, 'llms.txt');
  const llms = OFFLINE ? await readFile(indexPath, 'utf8') : await fetchText(INDEX_URL);
  if (!OFFLINE) await writeFile(indexPath, llms);

  const pages = parseIndex(llms);
  if (!OFFLINE) await downloadPages(pages);

  const cached = new Set(await readdir(PAGES_DIR));
  const byProduct = new Map<string, Operation[]>();
  const emptySpecPages: string[] = [];
  const allOps: (Operation & { class: string })[] = [];
  for (const page of pages) {
    if (!cached.has(`${page.slug}.md`)) throw new Error(`Falta en caché: ${page.slug}`);
    const markdown = await readFile(path.join(PAGES_DIR, `${page.slug}.md`), 'utf8');
    const { ops, emptySpec } = extractOperations(page, markdown);
    if (emptySpec) emptySpecPages.push(page.slug);
    for (const op of ops) {
      const list = byProduct.get(op.product) ?? [];
      list.push(op);
      byProduct.set(op.product, list);
      allOps.push({ ...op, class: classify(op) });
    }
  }

  const syncDate = new Date().toISOString().slice(0, 10);
  await mkdir(OUT_DIR, { recursive: true });
  for (const [product, ops] of byProduct) {
    await writeFile(
      path.join(OUT_DIR, `${productFile(product)}.md`),
      renderProduct(product, ops, syncDate),
    );
  }
  await writeFile(
    path.join(OUT_DIR, 'README.md'),
    renderIndex(byProduct, emptySpecPages, pages.length, syncDate),
  );
  // Detalle completo (descripciones, respuestas) para quien implemente herramientas; no se versiona.
  await writeFile(path.join(CACHE_DIR, 'inventory.json'), JSON.stringify(allOps, null, 1));
  console.error(
    `Listo: ${allOps.length} operaciones en ${byProduct.size} productos → ${path.relative(ROOT, OUT_DIR)}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
