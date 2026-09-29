import { describe, expect, it } from 'vitest';

import { HttpClient, HttpStatusError } from '../../src/http/client.ts';
import { LoginTokenProvider, StaticTokenProvider } from '../../src/loggro/restobar/auth.ts';
import { RestobarClient, mapRestobarError } from '../../src/loggro/restobar/client.ts';
import { RESTOBAR_ALLOWLIST } from '../../src/loggro/restobar/operations.ts';
import { fakeFetch, type RecordedRequest, type FakeResponse } from '../helpers/fake-fetch.ts';

const BASE = 'https://api.pirpos.test';

function setup(handler: (req: RecordedRequest) => FakeResponse, mode: 'token' | 'password') {
  const fake = fakeFetch(handler);
  const http = new HttpClient({
    baseUrl: BASE,
    allowlist: RESTOBAR_ALLOWLIST,
    fetch: fake.fetch,
    sleep: () => Promise.resolve(),
  });
  const tokens =
    mode === 'token'
      ? new StaticTokenProvider('tok-fijo')
      : new LoginTokenProvider(http, 'a@b.test', 'clave');
  return { client: new RestobarClient(http, tokens), calls: fake.calls };
}

describe('mapRestobarError', () => {
  const map = (status: number, message = '') =>
    mapRestobarError(new HttpStatusError(status, message));

  it.each([
    [401, 'Pedido no encontrado. Pedido id: 1', 'not_found'],
    [500, 'No encontrado o pertenece al negocio principal!', 'not_found'],
    [401, 'Las cuentas gratis solo pueden ver ventas de los últimos 30 días.', 'plan_limit'],
    [401, 'Token no válido', 'auth'],
    [402, 'Esta funcionalidad requiere una suscripción premium', 'premium'],
    [403, 'No tiene permisos para realizar esta acción', 'forbidden'],
    [429, '', 'rate_limited'],
    [503, '', 'unavailable'],
  ])('HTTP %i «%s» → %s', (status, message, kind) => {
    expect(map(status, message)).toMatchObject({ kind });
  });
});

describe('RestobarClient', () => {
  it('modo token: nunca hace login y no reintenta ante 401', async () => {
    const { client, calls } = setup(
      () => ({ status: 401, body: { message: 'Token no válido' } }),
      'token',
    );
    await expect(client.listCategories()).rejects.toMatchObject({ kind: 'auth' });
    expect(calls.map((c) => c.method + ' ' + c.url.pathname)).toEqual(['GET /categories']);
    expect(calls[0]?.headers.Authorization).toBe('Bearer tok-fijo');
  });

  it('modo usuario y clave: login perezoso y un único re-login ante sesión vencida', async () => {
    let logins = 0;
    let gets = 0;
    const { client, calls } = setup((req) => {
      if (req.url.pathname === '/login') return { body: { tokenCurrent: `t${++logins}` } };
      return ++gets === 1 ? { status: 401, body: { message: 'Token no válido' } } : { body: [] };
    }, 'password');
    await expect(client.listPaymentMethods()).resolves.toEqual([]);
    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
      'POST /login',
      'GET /paymentMethods',
      'POST /login',
      'GET /paymentMethods',
    ]);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ email: 'a@b.test', password: 'clave' });
    expect(calls[3]?.headers.Authorization).toBe('Bearer t2');
  });

  it('modo usuario y clave: credenciales inválidas no se reintentan', async () => {
    const { client, calls } = setup(
      () => ({ status: 400, body: { message: 'Correo o contraseña incorrectos.' } }),
      'password',
    );
    await expect(client.listCategories()).rejects.toMatchObject({ kind: 'auth' });
    await expect(client.listCategories()).rejects.toMatchObject({ kind: 'auth' });
    expect(calls).toHaveLength(1);
  });

  it('envía pagination=true y acepta { data, count }', async () => {
    const { client, calls } = setup(
      () => ({ body: { data: [{ _id: 'i1', total: 1000, status: 'Pagada' }], count: 7 } }),
      'token',
    );
    const page = await client.listInvoices({ page: 0, limit: 5, status: 'Pagada' });
    expect(page.count).toBe(7);
    expect(page.data[0]).toMatchObject({ _id: 'i1', total: 1000 });
    expect(Object.fromEntries(calls[0]?.url.searchParams ?? [])).toEqual({
      pagination: 'true',
      typeSort: 'desc',
      page: '0',
      limit: '5',
      status: 'Pagada',
    });
  });

  it('tolera campos con tipo inesperado sin romper la consulta', async () => {
    const { client } = setup(() => ({ body: [{ _id: 'c1', name: 42, isActive: 'sí' }] }), 'token');
    await expect(client.listCategories()).resolves.toMatchObject([
      { _id: 'c1', name: null, isActive: null },
    ]);
  });

  it('getInvoice convierte una respuesta null en «no encontrado»', async () => {
    const { client } = setup(() => ({ body: 'null' }), 'token');
    await expect(client.getInvoice('x')).rejects.toMatchObject({ kind: 'not_found' });
  });
});
