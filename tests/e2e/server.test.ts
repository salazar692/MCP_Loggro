import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { HttpClient } from '../../src/http/client.ts';
import { StaticTokenProvider } from '../../src/loggro/restobar/auth.ts';
import { RestobarClient } from '../../src/loggro/restobar/client.ts';
import { RESTOBAR_ALLOWLIST } from '../../src/loggro/restobar/operations.ts';
import { silentLogger } from '../../src/logging.ts';
import { createServer } from '../../src/server.ts';
import { VERSION } from '../../src/version.ts';
import { fakeFetch, type FakeResponse, type RecordedRequest } from '../helpers/fake-fetch.ts';

const EXPECTED_TOOLS = [
  'restobar_get_invoice',
  'restobar_list_categories',
  'restobar_list_clients',
  'restobar_list_invoices',
  'restobar_list_orders',
  'restobar_list_payment_methods',
  'restobar_list_products',
  'restobar_sales_by_day',
];

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
    logger: silentLogger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, calls: fake.calls };
}

describe('servidor MCP', () => {
  it('expone las herramientas esperadas, todas de solo lectura', async () => {
    const { client } = await connect(() => ({ body: [] }));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED_TOOLS);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
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

describe('versión', () => {
  it('coincide con package.json', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(import.meta.dirname, '../../package.json'), 'utf8'),
    ) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });
});
