/**
 * Prueba de humo contra la API REAL de Restobar, pensada para negocios en
 * producción. Garantías (independientes del código del servidor):
 *
 * - Solo modo token (LOGGRO_RESTOBAR_TOKEN): nunca hace login.
 * - Un `fetch` guardián bloquea, ANTES de la red, cualquier método distinto de
 *   GET y cualquier host distinto del configurado.
 * - Presupuesto de solicitudes por herramienta (máximo 5, acumulado entre
 *   ejecuciones en .cache/restobar-smoke-ledger.json). Sin reintentos.
 * - Imprime solo tipos, conteos y fechas técnicas; nunca nombres, documentos,
 *   teléfonos ni montos.
 *
 * Uso: node --env-file=.env scripts/smoke-restobar.ts [herramienta ...]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { loadConfig } from '../src/config.ts';
import { HttpClient } from '../src/http/client.ts';
import { StaticTokenProvider } from '../src/loggro/restobar/auth.ts';
import { RestobarClient } from '../src/loggro/restobar/client.ts';
import { RESTOBAR_ALLOWLIST } from '../src/loggro/restobar/operations.ts';
import { silentLogger } from '../src/logging.ts';
import { createServer } from '../src/server.ts';

const MAX_REQUESTS_PER_TOOL = 5;
const LEDGER = path.resolve(import.meta.dirname, '../.cache/restobar-smoke-ledger.json');

type Args = Record<string, unknown>;
interface Step {
  tool: string;
  args: (memory: Memory) => Args | null;
  note?: string;
}
interface Memory {
  invoiceId?: string;
}

function yesterdayInBogota(): string {
  const now = new Date(Date.now() - 5 * 3_600_000); // Colombia: UTC−5 sin horario de verano
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0, 10);
}

function daysAgoInBogota(days: number): string {
  const d = new Date(Date.now() - 5 * 3_600_000);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const PLAN: Step[] = [
  { tool: 'restobar_list_invoices', args: () => ({ pageSize: 2 }), note: 'recientes' },
  {
    tool: 'restobar_list_invoices',
    args: () => ({ dateFrom: yesterdayInBogota(), dateTo: yesterdayInBogota(), pageSize: 3 }),
    note: 'ayer (verifica zona horaria)',
  },
  { tool: 'restobar_get_invoice', args: (m) => (m.invoiceId ? { id: m.invoiceId } : null) },
  { tool: 'restobar_list_products', args: () => ({ pageSize: 2 }) },
  { tool: 'restobar_list_categories', args: () => ({}) },
  { tool: 'restobar_list_payment_methods', args: () => ({}) },
  { tool: 'restobar_list_orders', args: () => ({ pageSize: 2 }) },
  { tool: 'restobar_list_clients', args: () => ({ pageSize: 2 }) },
  {
    tool: 'restobar_sales_by_day',
    args: () => ({ dateFrom: daysAgoInBogota(7), dateTo: yesterdayInBogota() }),
  },
];

/** Describe la forma de un valor sin revelarlo. */
function shape(value: unknown, depth = 0): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return value.length === 0 ? 'array(0)' : [`array(${value.length})`, shape(value[0], depth + 1)];
  }
  if (typeof value === 'object' && depth < 4) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v, depth + 1)]));
  }
  return typeof value;
}

/** Para listas: cuántos elementos traen cada campo con valor (sin mostrarlo). */
function fill(items: unknown[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    for (const [k, v] of Object.entries(item)) {
      const [have = 0] = (out[k] ?? '0').split('/').map(Number);
      out[k] = `${have + (v === null ? 0 : 1)}/${items.length}`;
    }
  }
  return out;
}

function describeResult(tool: string, structured: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(structured)) {
    if (key === 'pagination') {
      console.log('  pagination:', JSON.stringify(value));
    } else if (Array.isArray(value)) {
      console.log(`  ${key}: ${value.length} elementos`);
      if (value.length) console.log('  tipos:', JSON.stringify(shape(value[0])));
      if (value.length) console.log('  campos con dato:', JSON.stringify(fill(value)));
      if (tool === 'restobar_list_invoices' && value.length) {
        const dates = value
          .map((v) => (v as { createdOn?: string | null }).createdOn)
          .filter((d): d is string => typeof d === 'string')
          .sort();
        console.log('  createdOn (rango):', dates[0], '→', dates.at(-1));
      }
      if (tool === 'restobar_sales_by_day') {
        console.log(
          '  fechas:',
          value.map((v) => (v as { date?: string | null }).date),
        );
      }
    } else if (typeof value === 'object' && value !== null) {
      console.log(`  ${key}:`, JSON.stringify(shape(value)));
    } else {
      console.log(`  ${key}: ${typeof value}`);
    }
  }
}

function describeToken(token: string): void {
  const payload = token.split('.')[1];
  if (!payload) return console.log('Token: no es un JWT; no se puede leer su vigencia.');
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      iat?: number;
      exp?: number;
    };
    const iat = claims.iat ? new Date(claims.iat * 1000).toISOString() : '¿?';
    const exp = claims.exp ? new Date(claims.exp * 1000).toISOString() : 'sin expiración';
    const days = claims.iat && claims.exp ? ((claims.exp - claims.iat) / 86_400).toFixed(2) : '¿?';
    console.log(`Token: emitido ${iat}, expira ${exp}, vigencia ${days} días (solo fechas).`);
  } catch {
    console.log('Token: no se pudo leer la vigencia.');
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.restobar.auth.mode !== 'token') {
    throw new Error('La prueba de humo solo usa LOGGRO_RESTOBAR_TOKEN (nunca hace login).');
  }
  describeToken(config.restobar.auth.token);

  const only = new Set(process.argv.slice(2));
  const plan = only.size ? PLAN.filter((s) => only.has(s.tool)) : PLAN;
  const ledger = JSON.parse(await readFile(LEDGER, 'utf8').catch(() => '{}')) as Record<
    string,
    number
  >;
  const allowedHost = new URL(config.restobar.baseUrl).host;
  let currentTool = '';

  const block = (reason: string): never => {
    console.log(`  BLOQUEADO antes de la red: ${reason}`);
    throw new Error(`BLOQUEADO: ${reason}`);
  };
  const guardedFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') block(`método ${method} no permitido`);
    if (url.host !== allowedHost) block(`host ${url.host} no permitido`);
    const used = ledger[currentTool] ?? 0;
    if (used >= MAX_REQUESTS_PER_TOOL) {
      block(`${currentTool} ya usó ${used} solicitudes (máximo ${MAX_REQUESTS_PER_TOOL})`);
    }
    ledger[currentTool] = used + 1;
    console.log(`  → GET ${url.pathname} (solicitud ${used + 1}/${MAX_REQUESTS_PER_TOOL})`);
    return fetch(url, init);
  };

  const http = new HttpClient({
    baseUrl: config.restobar.baseUrl,
    allowlist: RESTOBAR_ALLOWLIST,
    fetch: guardedFetch,
    maxRetries: 0,
    logger: silentLogger,
  });
  const server = createServer({
    restobar: new RestobarClient(http, new StaticTokenProvider(config.restobar.auth.token)),
    redactPersonalData: config.redactPersonalData,
    timeZone: config.timeZone,
    logger: silentLogger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'smoke', version: '0' });
  await client.connect(clientTransport);

  const memory: Memory = {};
  try {
    for (const step of plan) {
      const args = step.args(memory);
      console.log(`\n# ${step.tool}${step.note ? ` (${step.note})` : ''}`);
      if (args === null) {
        console.log('  omitida: falta un dato de un paso anterior');
        continue;
      }
      if ((ledger[step.tool] ?? 0) >= MAX_REQUESTS_PER_TOOL) {
        console.log('  omitida: presupuesto de solicitudes agotado');
        continue;
      }
      currentTool = step.tool;
      const result = await client.callTool({ name: step.tool, arguments: args });
      const structured = result.structuredContent as Record<string, unknown> | undefined;
      if (result.isError || !structured) {
        const content = result.content as { text?: string }[] | undefined;
        console.log('  ERROR:', content?.[0]?.text ?? 'sin detalle');
        continue;
      }
      console.log('  OK');
      describeResult(step.tool, structured);
      const invoices = structured.invoices as { id?: string }[] | undefined;
      memory.invoiceId ??= invoices?.[0]?.id;
    }
  } finally {
    await mkdir(path.dirname(LEDGER), { recursive: true });
    await writeFile(LEDGER, JSON.stringify(ledger, null, 2));
    console.log('\nSolicitudes acumuladas por herramienta:', JSON.stringify(ledger));
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
