import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { HttpClient } from '../../src/http/client.ts';
import { StaticTokenProvider } from '../../src/loggro/restobar/auth.ts';
import { BranchSource, resolveBranch } from '../../src/loggro/restobar/branches.ts';
import { RestobarClient } from '../../src/loggro/restobar/client.ts';
import { RESTOBAR_ALLOWLIST } from '../../src/loggro/restobar/operations.ts';
import { silentLogger } from '../../src/logging.ts';
import { createServer } from '../../src/server.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';

const BRANCHES = [
  { id: 'viva', name: 'Viva' },
  { id: 'meridiem', name: 'Meridiem' },
];

/** Dos sucursales con token propio; `connected` registra qué sucursales se conectaron. */
async function connect() {
  const fake = fakeFetch(() => ({ body: [] }));
  const connected: string[] = [];
  const source = new BranchSource(BRANCHES, (branch) => {
    connected.push(branch.id);
    const http = new HttpClient({
      baseUrl: 'https://api.pirpos.test',
      allowlist: RESTOBAR_ALLOWLIST,
      fetch: fake.fetch,
      sleep: () => Promise.resolve(),
    });
    return new RestobarClient(http, new StaticTokenProvider(`token-${branch.id}`));
  });
  const server = createServer({
    restobar: source,
    redactPersonalData: false,
    timeZone: 'America/Bogota',
    exportDir: null,
    logger: silentLogger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, calls: fake.calls, connected };
}

describe('sucursales', () => {
  it('resuelve por id, por nombre sin tildes ni mayúsculas y por nombre dentro de una frase', () => {
    const branches = [...BRANCHES, { id: 'centro', name: 'Centro Histórico' }];
    expect(resolveBranch(branches, 'meridiem').id).toBe('meridiem');
    expect(resolveBranch(branches, 'VIVA').id).toBe('viva');
    expect(resolveBranch(branches, 'la sucursal del Viva').id).toBe('viva');
    expect(resolveBranch(branches, 'centro historico').id).toBe('centro');
    expect(() => resolveBranch(branches, undefined)).toThrow(/Viva, Meridiem, Centro Histórico/);
    expect(() => resolveBranch(branches, 'Norte')).toThrow(/No existe la sucursal «Norte»/);
    expect(resolveBranch([{ id: 'x', name: 'Única' }], undefined).id).toBe('x');
  });

  it('lista las sucursales y exige «branch» cuando hay varias', async () => {
    const { client, calls } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('restobar_list_branches');
    const sales = tools.find((t) => t.name === 'restobar_sales_by_day');
    expect(sales?.inputSchema.properties).toHaveProperty('branch');

    const list = await client.callTool({ name: 'restobar_list_branches', arguments: {} });
    expect(list.structuredContent).toEqual({ branches: BRANCHES });

    const missing = await client.callTool({
      name: 'restobar_sales_by_day',
      arguments: { dateFrom: '2026-09-28', dateTo: '2026-09-28' },
    });
    expect(missing.isError).toBe(true);
    expect(JSON.stringify(missing.content)).toMatch(/Viva, Meridiem/);
    expect(calls).toHaveLength(0);
  });

  it('cada sucursal consulta con su propio token', async () => {
    const { client, calls, connected } = await connect();
    await client.callTool({
      name: 'restobar_sales_by_day',
      arguments: { dateFrom: '2026-09-28', dateTo: '2026-09-28', branch: 'sucursal del Viva' },
    });
    await client.callTool({
      name: 'restobar_list_categories',
      arguments: { branch: 'Meridiem' },
    });
    await client.callTool({ name: 'restobar_list_categories', arguments: { branch: 'viva' } });
    expect(calls.map((c) => c.headers.Authorization)).toEqual([
      'Bearer token-viva',
      'Bearer token-meridiem',
      'Bearer token-viva',
    ]);
    expect(connected).toEqual(['viva', 'meridiem']); // cada cliente se crea una sola vez
  });
});
