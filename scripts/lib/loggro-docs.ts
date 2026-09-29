/**
 * Análisis de la documentación oficial de Loggro (índice llms.txt + páginas
 * Markdown con OpenAPI) y generación del inventario de endpoints.
 *
 * Funciones puras: sin red ni disco, para poder probarlas. La E/S vive en
 * scripts/sync-loggro-docs.ts.
 */

export const DOCS_ORIGIN = 'https://developer.loggro.com';
export const INDEX_URL = `${DOCS_ORIGIN}/llms.txt`;

export interface IndexedPage {
  slug: string;
  section: string;
}

type Primitive = string | number | boolean;

export interface Parameter {
  name: string;
  in: string;
  required: boolean;
  default?: Primitive;
  maximum?: number;
}

export interface Operation {
  product: string;
  slug: string;
  updatedAt: string;
  servers: string[];
  securitySchemes: string[];
  method: string;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  params: Parameter[];
  body: { required: boolean; types: string[] } | null;
  responses: Record<string, string>;
  paginationHeaders: boolean;
  permissions: string[];
  premium: boolean;
  trial: boolean;
}

// ---------------------------------------------------------------------------
// Reglas de clasificación. El método HTTP NO basta: en Loggro hay GET con
// efectos secundarios y consultas expuestas como POST. Cada excepción manual
// cita el texto oficial que la justifica.
// ---------------------------------------------------------------------------

export const CLASSES = {
  read: 'lectura',
  readViaPost: 'lectura (POST)',
  write: 'escritura',
  sideEffect: '⚠ GET con efecto',
  unconfirmed: '⚠ por confirmar',
  auth: 'autenticación',
  superadmin: 'excluido: superadmin',
  planned: 'planeado',
  inbound: 'entrante',
} as const;

export type OperationClass = (typeof CLASSES)[keyof typeof CLASSES];

/** GET cuya documentación describe un efecto secundario (envío, generación). */
const GET_WITH_SIDE_EFFECTS = new Set([
  'Nómina GET /pagos/adelantarPagoNomina', // "Adelantar pago de nómina."
  'Nómina GET /pagos/enviarComprobantesPagoNomina', // "Enviar comprobantes de pago por correo."
  'Nómina GET /pagoEmpleados/enviarComprobantePagoNominaEmpleado', // "Enviar comprobante por correo al empleado."
  'Nómina GET /anticipo-cesantias/generarPago', // "Generar pago de anticipo."
]);

/** GET descritos como "Calcular …" sin documentar si persisten resultados. */
const GET_UNCONFIRMED = new Set([
  'Nómina GET /pagos/pagarNominaPeriodica',
  'Nómina GET /pagos/pagarPrima',
  'Nómina GET /pagos/pagarCesantias',
  'Nómina GET /pagos/pagarInteresesCesantias',
  'Nómina GET /pagos/liquidacionDefinitiva',
  'Nómina GET /pagos/pagosEspeciales',
  'Nómina GET /anticipo-cesantias/calcularValores',
  'Nómina GET /novedades/diasHabiles',
]);

const AUTH_OPERATIONS = new Set([
  'Restobar POST /login',
  'Documentos Electrónicos POST /auth',
  'ALOJAMIENTOS POST /api/v1/sessions',
  'ALOJAMIENTOS POST /api/v1/sessions/send_otp',
  'ALOJAMIENTOS DELETE /api/v1/sessions',
]);

/** Endpoints que invoca un sistema externo, no el integrador ("Integraciones entrantes"). */
const INBOUND_OPERATIONS = new Set(['ALOJAMIENTOS POST /api/otas/booking/diagnostics']);

/** Consultas documentadas que usan POST como transporte. */
function isReadViaPost(op: Operation): boolean {
  if (op.method !== 'POST') return false;
  // Servicios SOAP de Facturación Electrónica / Documento Soporte: las
  // operaciones "consultar*" solo consultan. La confirmación de lotes es un
  // servicio aparte (confirmarLotePorOrigenDocumentosRecibidos).
  if (op.product === 'Documentos Electrónicos' && op.path.startsWith('/consultar')) return true;
  // "Consulta la disponibilidad de uno o varios productos en un establecimiento."
  return op.product === 'PYMES' && op.path === '/v1/productos/disponibilidad-productos';
}

export function classify(op: Operation): OperationClass {
  const key = `${op.product} ${op.method} ${op.path}`;
  if (AUTH_OPERATIONS.has(key)) return CLASSES.auth;
  if (INBOUND_OPERATIONS.has(key)) return CLASSES.inbound;
  if (op.summary.includes('(PirPos SuperAdmin)')) return CLASSES.superadmin;
  if (/Funcionalidad planeada/i.test(op.description)) return CLASSES.planned;
  if (GET_WITH_SIDE_EFFECTS.has(key)) return CLASSES.sideEffect;
  if (GET_UNCONFIRMED.has(key)) return CLASSES.unconfirmed;
  if (isReadViaPost(op)) return CLASSES.readViaPost;
  if (op.method === 'GET' || op.method === 'HEAD') return CLASSES.read;
  return CLASSES.write;
}

// ---------------------------------------------------------------------------
// Análisis del índice y de las páginas
// ---------------------------------------------------------------------------

/** Devuelve las páginas de referencia en el orden del índice oficial. */
export function parseIndex(llms: string): IndexedPage[] {
  const pages: IndexedPage[] = [];
  const seen = new Set<string>();
  let section = '';
  for (const line of llms.split('\n')) {
    const heading = /^## (.*)/.exec(line);
    if (heading?.[1] !== undefined) {
      section = heading[1].replace('Documentación: ', '').trim();
      continue;
    }
    for (const m of line.matchAll(/https:\/\/developer\.loggro\.com\/reference\/([^)\s]*)\.md/g)) {
      const slug = m[1];
      if (slug !== undefined && !seen.has(slug)) {
        seen.add(slug);
        pages.push({ slug, section });
      }
    }
  }
  return pages;
}

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const asObject = (v: unknown): JsonObject => (isObject(v) ? v : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

function resolveRef(spec: unknown, value: unknown, depth = 0): JsonObject {
  if (!isObject(value) || depth > 8) return {};
  const ref = value.$ref;
  if (typeof ref === 'string' && ref.startsWith('#/')) {
    let cur: unknown = spec;
    for (const part of ref.slice(2).split('/')) cur = asObject(cur)[part];
    return resolveRef(spec, cur, depth + 1);
  }
  return value;
}

function extractPermissions(text: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /Permiso requerido[^`\n]*`([A-Z0-9_]+)`/g,
    /requiere ([A-Z]{2}_[A-Z0-9_]+)/g,
    /Requiere el permiso \*\*([A-Z0-9_]+)\*\*/g,
  ];
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) if (m[1]) found.add(m[1]);
  }
  return [...found];
}

const OPENAPI_BLOCK = /# OpenAPI definition\s*\n(`{3,4})json\n([\s\S]*?)\n\1(?:\n|$)/g;
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function toParameter(spec: unknown, raw: unknown): Parameter {
  const p = resolveRef(spec, raw);
  const schema = resolveRef(spec, p.schema);
  const param: Parameter = {
    name: asString(p.name),
    in: asString(p.in),
    required: p.required === true,
  };
  const def = schema.default;
  if (typeof def === 'string' || typeof def === 'number' || typeof def === 'boolean') {
    param.default = def;
  }
  if (typeof schema.maximum === 'number') param.maximum = schema.maximum;
  return param;
}

/**
 * Extrae las operaciones declaradas en el OpenAPI embebido de una página.
 * `emptySpec` indica que la página publica un OpenAPI vacío (`{}`).
 */
export function extractOperations(
  page: IndexedPage,
  markdown: string,
): { ops: Operation[]; emptySpec: boolean } {
  const updatedAt = /updatedAt: (\S+)/.exec(markdown)?.[1]?.slice(0, 10) ?? '';
  const ops: Operation[] = [];
  let emptySpec = false;
  for (const match of markdown.matchAll(OPENAPI_BLOCK)) {
    const spec: unknown = JSON.parse(match[2] ?? '{}');
    const doc = asObject(spec);
    if (!isObject(doc.paths)) {
      emptySpec = true;
      continue;
    }
    const servers = asArray(doc.servers).map((s) => asString(asObject(s).url));
    const schemes = Object.entries(asObject(asObject(doc.components).securitySchemes)).map(
      ([name, s]) => {
        const scheme = asObject(s);
        return `${name}: ${asString(scheme.type)}/${asString(scheme.scheme) || asString(scheme.in)}`;
      },
    );
    for (const [apiPath, rawItem] of Object.entries(doc.paths)) {
      const item = asObject(rawItem);
      for (const method of HTTP_METHODS) {
        const op = item[method];
        if (!isObject(op)) continue;
        const params = [...asArray(item.parameters), ...asArray(op.parameters)].map((p) =>
          toParameter(spec, p),
        );
        const body = resolveRef(spec, op.requestBody);
        const rawResponses = Object.entries(asObject(op.responses)).map(
          ([code, r]) => [code, resolveRef(spec, r)] as const,
        );
        const responses = Object.fromEntries(
          rawResponses.map(([code, r]) => [code, asString(r.description).trim()]),
        );
        const description = asString(op.description).trim();
        const text = [description, ...Object.values(responses)].join('\n');
        ops.push({
          product: page.section,
          slug: page.slug,
          updatedAt,
          servers,
          securitySchemes: schemes,
          method: method.toUpperCase(),
          path: apiPath,
          operationId: asString(op.operationId),
          summary: asString(op.summary).trim(),
          description,
          params,
          body: isObject(body.content)
            ? { required: body.required === true, types: Object.keys(body.content) }
            : null,
          responses,
          paginationHeaders: rawResponses.some(([, r]) => 'Total-Count' in asObject(r.headers)),
          permissions: extractPermissions(text),
          premium: /premium/i.test(text),
          trial: /periodo de prueba|trial/i.test(text),
        });
      }
    }
  }
  return { ops, emptySpec };
}

// ---------------------------------------------------------------------------
// Salida Markdown
// ---------------------------------------------------------------------------

const PAGINATION_PARAMS = new Set([
  'pagination',
  'page',
  'pagina',
  'limit',
  'size',
  'tamano',
  'offset',
]);

const cell = (s: string): string =>
  s
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

function formatPagination(op: Operation): string {
  const parts = op.params
    .filter((p) => p.in === 'query' && PAGINATION_PARAMS.has(p.name))
    .map((p) => {
      const meta: string[] = [];
      if (p.default !== undefined) meta.push(`def ${String(p.default)}`);
      if (p.maximum !== undefined) meta.push(`máx ${p.maximum}`);
      return meta.length ? `\`${p.name}\` (${meta.join(', ')})` : `\`${p.name}\``;
    });
  if (op.paginationHeaders) parts.push('headers `Total-Count`…');
  return parts.join(' ');
}

function formatParams(op: Operation, required: boolean): string {
  const names = op.params
    .filter(
      (p) =>
        p.required === required &&
        p.in !== 'header' &&
        (required || !PAGINATION_PARAMS.has(p.name)),
    )
    .map((p) => (p.in === 'path' ? `\`{${p.name}}\`` : `\`${p.name}\``));
  if (op.body && op.body.required === required) names.push(`body (${op.body.types.join(', ')})`);
  return names.join(' ');
}

function formatNotes(op: Operation): string {
  const notes: string[] = [];
  if (op.permissions.length) {
    notes.push(`permiso ${op.permissions.map((p) => `\`${p}\``).join(', ')}`);
  }
  if (op.premium) notes.push('premium');
  if (op.trial) notes.push('límite trial');
  if (op.params.some((p) => p.in === 'header' && p.name === 'X-Api-Key')) notes.push('`X-Api-Key`');
  return notes.join('; ');
}

export const productFile = (product: string): string =>
  product
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function countBy<T>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

export function renderProduct(product: string, ops: Operation[], syncDate: string): string {
  const servers = [...new Set(ops.flatMap((o) => o.servers))];
  const schemes = [...new Set(ops.flatMap((o) => o.securitySchemes))];
  const counts = countBy(ops.map(classify));
  const lines = [
    `# Inventario de endpoints — ${product}`,
    '',
    '> Generado por `scripts/sync-loggro-docs.ts` a partir de la documentación oficial',
    `> (${INDEX_URL}) el ${syncDate}. **No editar a mano**: volver a ejecutar el script.`,
    '> Resúmenes y parámetros son transcripción literal del OpenAPI oficial; la columna',
    '> «Clase» es una clasificación de este proyecto (ver `docs/loggro-api/README.md`).',
    '',
    `- **Operaciones:** ${ops.length}`,
    `- **Por clase:** ${[...counts].map(([k, v]) => `${k} ${v}`).join(' · ')}`,
    `- **URL base declarada en OpenAPI:** ${servers.map((s) => `\`${s}\``).join(', ') || '—'}`,
    `- **Esquemas de seguridad declarados en OpenAPI:** ${
      schemes.map((s) => `\`${s}\``).join(', ') ||
      'ninguno (ver cabecera `Authorization` por endpoint)'
    }`,
    '',
    '| Clase | Método | Ruta | Resumen oficial | Obligatorios | Opcionales | Paginación | Códigos HTTP | Notas | Fuente |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const op of ops) {
    const cells = [
      classify(op),
      op.method,
      `\`${op.path}\``,
      op.summary,
      formatParams(op, true),
      formatParams(op, false),
      formatPagination(op),
      Object.keys(op.responses).sort().join(' '),
      formatNotes(op),
      `[${op.slug}](${DOCS_ORIGIN}/reference/${op.slug}) ${op.updatedAt}`,
    ];
    lines.push(`| ${cells.map(cell).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderIndex(
  byProduct: Map<string, Operation[]>,
  emptySpecPages: string[],
  pageCount: number,
  syncDate: string,
): string {
  const classes = Object.values(CLASSES);
  const header = ['Producto', 'Total', ...classes];
  const total = [...byProduct.values()].reduce((n, o) => n + o.length, 0);
  const lines = [
    '# Inventario de endpoints de Loggro',
    '',
    `> Generado por \`scripts/sync-loggro-docs.ts\` el ${syncDate} desde ${INDEX_URL}.`,
    '> **No editar a mano.**',
    '',
    `Páginas en el índice oficial: ${pageCount}. Operaciones extraídas: ${total}.`,
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
  ];
  for (const [product, ops] of byProduct) {
    const counts = countBy(ops.map(classify));
    const perClass = classes.map((c) => counts.get(c) ?? 0).join(' | ');
    lines.push(`| [${product}](./${productFile(product)}.md) | ${ops.length} | ${perClass} |`);
  }
  lines.push(
    '',
    '## Páginas con definición OpenAPI vacía',
    '',
    'Documentadas en el índice, pero sin operación declarada (`{}`); no se pueden usar sin confirmar con Loggro:',
    '',
  );
  for (const slug of emptySpecPages) lines.push(`- [${slug}](${DOCS_ORIGIN}/reference/${slug})`);
  return `${lines.join('\n')}\n`;
}
