import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, describe, expect, it } from 'vitest';

import { HttpClient } from '../../src/http/client.ts';
import { StaticTokenProvider } from '../../src/loggro/restobar/auth.ts';
import { RestobarClient } from '../../src/loggro/restobar/client.ts';
import { RESTOBAR_ALLOWLIST } from '../../src/loggro/restobar/operations.ts';
import { silentLogger } from '../../src/logging.ts';
import { createServer } from '../../src/server.ts';
import { VERSION } from '../../src/version.ts';
import { fakeFetch, type FakeResponse, type RecordedRequest } from '../helpers/fake-fetch.ts';
import { unzip } from '../helpers/unzip.ts';

const EXPECTED_TOOLS = [
  'restobar_clients_summary',
  'restobar_export_clients',
  'restobar_get_invoice',
  'restobar_list_categories',
  'restobar_list_clients',
  'restobar_list_invoices',
  'restobar_list_orders',
  'restobar_list_payment_methods',
  'restobar_list_products',
  'restobar_sales_by_day',
];

const exportDir = mkdtempSync(path.join(tmpdir(), 'mcp-loggro-e2e-'));
afterAll(async () => {
  const { rm } = await import('node:fs/promises');
  await rm(exportDir, { recursive: true, force: true });
});

async function connect(handler: (req: RecordedRequest) => FakeResponse, redact = false) {
  const fake = fakeFetch(handler);
  const http = new HttpClient({
    baseUrl: 'https://api.pirpos.test',
    allowlist: RESTOBAR_ALLOWLIST,
    fetch: fake.fetch,
    sleep: () => Promise.resolve(),
  });
  const server = createServer({
    restobar: new RestobarClient(http, new StaticTokenProvider('tok')),
    redactPersonalData: redact,
    timeZone: 'America/Bogota',
    exportDir,
    logger: silentLogger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, calls: fake.calls };
}

describe('servidor MCP', () => {
  it('expone las herramientas esperadas; solo la exportación escribe (un archivo local nuevo)', async () => {
    const { client } = await connect(() => ({ body: [] }));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED_TOOLS);
    for (const tool of tools) {
      const writesLocalFile = tool.name === 'restobar_export_clients';
      expect(tool.annotations).toMatchObject({
        readOnlyHint: !writesLocalFile,
        destructiveHint: false,
      });
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it('restobar_list_invoices: mapea fechas, paginación y salida', async () => {
    const { client, calls } = await connect(() => ({
      body: {
        data: [
          {
            _id: 'f1',
            invoicePrefix: 'FV',
            number: '120',
            total: 50000,
            totalPaid: 50000,
            status: 'Pagada',
            type: 'Normal',
            createdOn: '2026-09-28T18:00:00.000Z',
            client: { idInternal: 'c1', name: 'Cliente Demo', phone: '3000000000' },
            business: { nit: '900000000', address: 'Calle 1' },
            eInvoice: { DIAN: { dianState: '00' } },
          },
        ],
        count: 41,
      },
    }));
    const result = await client.callTool({
      name: 'restobar_list_invoices',
      arguments: { dateFrom: '2026-09-28', dateTo: '2026-09-28', page: 2, pageSize: 20 },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      invoices: [
        {
          id: 'f1',
          prefix: 'FV',
          number: '120',
          status: 'Pagada',
          type: 'Normal',
          total: 50000,
          totalPaid: 50000,
          createdOn: '2026-09-28T18:00:00.000Z',
          client: { id: 'c1', name: 'Cliente Demo', phone: '3000000000' },
          table: null,
          dianState: '00',
        },
      ],
      pagination: { page: 2, pageSize: 20, total: 41, hasMore: true },
    });
    const query = Object.fromEntries(calls[0]?.url.searchParams ?? []);
    expect(query).toMatchObject({
      page: '1',
      limit: '20',
      pagination: 'true',
      dateInit: '2026-09-28T05:00:00.000Z',
      dateEnd: '2026-09-29T04:59:59.999Z',
    });
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('oculta datos personales cuando la redacción está activa', async () => {
    const { client } = await connect(
      () => ({
        body: { data: [{ _id: 'c1', name: 'Ana', document: '123', phone: '300' }], count: 1 },
      }),
      true,
    );
    const result = await client.callTool({ name: 'restobar_list_clients', arguments: {} });
    expect(result.structuredContent).toMatchObject({
      clients: [{ id: 'c1', name: 'Ana', document: null, phone: null }],
    });
  });

  it('devuelve errores accionables sin detalles internos', async () => {
    const { client } = await connect(() => ({
      status: 402,
      body: { message: 'Esta funcionalidad requiere una suscripción premium' },
    }));
    const result = await client.callTool({ name: 'restobar_list_categories', arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/plan premium/);
    expect(JSON.stringify(result.content)).not.toContain('tok');
  });

  it('lee el día de ventas desde _id.dayOfMonth, como responde la API real', async () => {
    const { client } = await connect(() => ({
      body: [
        {
          _id: { businessId: 'b1', dayOfMonth: '2026-09-27' },
          total: 100,
          dateInit: '2026-09-27T05:00:00.000Z',
          dateEnd: '2026-09-28T04:59:59.999Z',
          totalWithoutTip: 90,
          tip: 10,
          count: 4,
        },
      ],
    }));
    const result = await client.callTool({
      name: 'restobar_sales_by_day',
      arguments: { dateFrom: '2026-09-27', dateTo: '2026-09-27' },
    });
    expect(result.structuredContent).toEqual({
      days: [{ date: '2026-09-27', total: 100, invoices: 4 }],
      grandTotal: 100,
    });
  });

  it('valida argumentos antes de llamar a Restobar', async () => {
    const { client, calls } = await connect(() => ({ body: [] }));
    const result = await client.callTool({
      name: 'restobar_sales_by_day',
      arguments: { dateFrom: '28/09/2026', dateTo: '2026-09-28' },
    });
    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

/** /clients paginado: `total` clientes de prueba, página y límite según la consulta. */
function clientsApi(total: number, served = total) {
  return (req: RecordedRequest): FakeResponse => {
    const page = Number(req.url.searchParams.get('page'));
    const limit = Number(req.url.searchParams.get('limit'));
    const data = Array.from(
      { length: Math.max(0, Math.min(limit, served - page * limit)) },
      (_, k) => {
        const i = page * limit + k;
        return {
          _id: `c${i}`,
          name: `Cliente ${i}`,
          isSocialReason: i % 10 === 0,
          document: `00${i}`,
          email: i % 2 === 0 ? `cliente${i}@ejemplo.test` : null,
          phone: '3000000000',
          city: i % 3 === 0 ? 'Bogotá' : 'BOGOTA',
          points: i % 4 === 0 ? 10 : 0,
          createdOn: '2026-09-01T03:00:00.000Z', // 31 de agosto en Bogotá
        };
      },
    );
    return { body: { data, count: total } };
  };
}

describe('listados grandes', () => {
  it('avisa que no se recorran todas las páginas y sugiere exportar o resumir', async () => {
    const { client } = await connect(() => ({ body: { data: [], count: 3482 } }));
    const result = await client.callTool({ name: 'restobar_list_clients', arguments: {} });
    const { pagination } = result.structuredContent as { pagination: { notice?: string } };
    expect(pagination.notice).toMatch(/^Hay 3482 resultados \(175 páginas de 20\)/);
    expect(pagination.notice).toContain('restobar_export_clients');
  });

  it('no avisa con pocos resultados', async () => {
    const { client } = await connect(() => ({ body: { data: [], count: 150 } }));
    const result = await client.callTool({ name: 'restobar_list_clients', arguments: {} });
    expect(result.structuredContent).toMatchObject({ pagination: { total: 150 } });
    expect(JSON.stringify(result.structuredContent)).not.toContain('notice');
  });

  it('restobar_clients_summary: descarga por lotes y devuelve solo cifras', async () => {
    const { client, calls } = await connect(clientsApi(1100));
    const result = await client.callTool({ name: 'restobar_clients_summary', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(calls.map((c) => c.url.searchParams.get('page'))).toEqual(['0', '1', '2']);
    expect(
      calls.every((c) => c.method === 'GET' && c.url.searchParams.get('limit') === '500'),
    ).toBe(true);
    expect(result.structuredContent).toMatchObject({
      clients: 1100,
      reportedTotal: 1100,
      complete: true,
      companies: 110,
      individuals: 990,
      withEmail: 550,
      withLoyaltyPoints: 275,
      totalLoyaltyPoints: 2750,
      newClientsByYear: [{ year: '2026', count: 1100 }],
      topCities: [{ city: 'Bogotá', count: 1100 }],
      restobarRequests: 3,
    });
    const text = JSON.stringify(result.structuredContent);
    expect(text).not.toContain('@ejemplo.test');
    expect(text).toContain('{"month":"2026-08","count":1100}');
  });

  it('restobar_clients_summary: marca como incompleto si Restobar entrega menos', async () => {
    const { client } = await connect(clientsApi(1100, 700));
    const result = await client.callTool({ name: 'restobar_clients_summary', arguments: {} });
    expect(result.structuredContent).toMatchObject({ clients: 700, complete: false });
  });

  it('rechaza descargas demasiado grandes tras una sola solicitud', async () => {
    const { client, calls } = await connect(clientsApi(80_000));
    const result = await client.callTool({ name: 'restobar_export_clients', arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/máximo por descarga es 50000/);
    expect(calls).toHaveLength(1);
  });

  it('restobar_export_clients: crea un Excel local y al modelo solo le da ruta y conteo', async () => {
    const { client } = await connect(clientsApi(3));
    const result = await client.callTool({
      name: 'restobar_export_clients',
      arguments: { search: 'Cliente' },
    });
    expect(result.isError).toBeFalsy();
    const out = result.structuredContent as { file: string; rows: number; columns: string[] };
    expect(out).toMatchObject({ rows: 3, complete: true, personalDataIncluded: true });
    expect(path.dirname(out.file)).toBe(exportDir);
    expect(path.basename(out.file)).toMatch(
      /^restobar-clientes-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d+)?\.xlsx$/,
    );
    expect(JSON.stringify(result)).not.toContain('@ejemplo.test');
    const sheet = unzip(readFileSync(out.file)).get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheet).toContain('cliente0@ejemplo.test');
    expect(sheet).toContain('>000</t>'); // documento con ceros a la izquierda
    expect(sheet).toContain('>2026-08-31 22:00</t>'); // fecha de creación en hora de Bogotá
  });

  it('restobar_export_clients: con redacción activa omite las columnas personales', async () => {
    const { client } = await connect(clientsApi(2), true);
    const result = await client.callTool({ name: 'restobar_export_clients', arguments: {} });
    const out = result.structuredContent as { file: string; columns: string[] };
    expect(out.columns).not.toContain('Correo');
    expect(out.columns).toContain('Nombre');
    const sheet = unzip(readFileSync(out.file)).get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheet).not.toContain('@ejemplo.test');
    expect(readdirSync(exportDir).length).toBeGreaterThan(0);
  });
});

describe('versión', () => {
  it('coincide con package.json', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(import.meta.dirname, '../../package.json'), 'utf8'),
    ) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });
});
