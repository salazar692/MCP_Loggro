import { describe, expect, it } from 'vitest';

import {
  CLASSES,
  classify,
  extractOperations,
  parseIndex,
  productFile,
  renderProduct,
  type Operation,
} from '../../scripts/lib/loggro-docs.ts';

function op(overrides: Partial<Operation> & Pick<Operation, 'product' | 'method' | 'path'>) {
  return {
    slug: 'ejemplo',
    updatedAt: '2026-01-01',
    servers: [],
    securitySchemes: [],
    operationId: '',
    summary: '',
    description: '',
    params: [],
    body: null,
    responses: {},
    paginationHeaders: false,
    permissions: [],
    premium: false,
    trial: false,
    ...overrides,
  } satisfies Operation;
}

describe('parseIndex', () => {
  it('asigna cada página a su sección y elimina duplicados', () => {
    const llms = [
      '## Documentación: Restobar',
      '- [Login](https://developer.loggro.com/reference/iniciarsesion.md): texto',
      '- [Otra vez](https://developer.loggro.com/reference/iniciarsesion.md)',
      '## Documentación: PYMES',
      '  - [Clientes](https://developer.loggro.com/reference/listarclientespymes.md)',
    ].join('\n');

    expect(parseIndex(llms)).toEqual([
      { slug: 'iniciarsesion', section: 'Restobar' },
      { slug: 'listarclientespymes', section: 'PYMES' },
    ]);
  });
});

describe('classify', () => {
  it('trata un GET sin excepciones como lectura', () => {
    expect(classify(op({ product: 'Restobar', method: 'GET', path: '/invoices' }))).toBe(
      CLASSES.read,
    );
  });

  it('marca los GET de Nómina que envían correos o generan pagos', () => {
    for (const path of ['/pagos/enviarComprobantesPagoNomina', '/anticipo-cesantias/generarPago']) {
      expect(classify(op({ product: 'Nómina', method: 'GET', path }))).toBe(CLASSES.sideEffect);
    }
  });

  it('no da por lectura los GET «Calcular …» de Nómina', () => {
    expect(
      classify(op({ product: 'Nómina', method: 'GET', path: '/pagos/pagarNominaPeriodica' })),
    ).toBe(CLASSES.unconfirmed);
  });

  it('reconoce consultas SOAP por POST, pero no la confirmación de lotes', () => {
    const product = 'Documentos Electrónicos';
    expect(
      classify(op({ product, method: 'POST', path: '/consultarInformacionDocumentoElectronico' })),
    ).toBe(CLASSES.readViaPost);
    expect(
      classify(op({ product, method: 'POST', path: '/confirmarLotePorOrigenDocumentosRecibidos' })),
    ).toBe(CLASSES.write);
  });

  it('trata como escritura un POST que «verifica y actualiza»', () => {
    const path = '/products/verifyProductInheritanceCurrentBusiness';
    expect(classify(op({ product: 'Restobar', method: 'POST', path }))).toBe(CLASSES.write);
  });

  it('excluye los endpoints de SuperAdmin y los planeados', () => {
    expect(
      classify(
        op({
          product: 'Restobar',
          method: 'GET',
          path: '/stats/pp/totalInvoicesByDays',
          summary: '(PirPos SuperAdmin) Total de facturas por día de toda la plataforma',
        }),
      ),
    ).toBe(CLASSES.superadmin);
    expect(
      classify(
        op({
          product: 'PYMES',
          method: 'GET',
          path: '/v1/formas-de-pago',
          description: '⚠️ **Funcionalidad planeada, todavía no implementada.**',
        }),
      ),
    ).toBe(CLASSES.planned);
  });

  it('identifica el login de Restobar como autenticación', () => {
    expect(classify(op({ product: 'Restobar', method: 'POST', path: '/login' }))).toBe(
      CLASSES.auth,
    );
  });
});

describe('extractOperations', () => {
  const page = { slug: 'consultarcuadrescaja', section: 'Restobar' };
  const spec = {
    openapi: '3.0.0',
    servers: [{ url: 'https://api.ejemplo.test' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      parameters: {
        Limit: {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', default: 10, maximum: 50 },
        },
      },
    },
    paths: {
      '/cashbox': {
        get: {
          summary: 'Consultar cuadres de caja',
          description: '**Permiso requerido:** `CB_GET_ALL`. Negocios no premium: solo el último.',
          parameters: [
            { $ref: '#/components/parameters/Limit' },
            { name: 'Authorization', in: 'header', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' }, '403': { description: 'Sin permisos' } },
        },
      },
    },
  };

  it('extrae operación, parámetros con $ref, permisos y marca premium', () => {
    const markdown = `---\nupdatedAt: 2026-02-27T15:25:48.000Z\n---\n\n# OpenAPI definition\n\n\`\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\`\n`;
    const { ops, emptySpec } = extractOperations(page, markdown);

    expect(emptySpec).toBe(false);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      product: 'Restobar',
      method: 'GET',
      path: '/cashbox',
      updatedAt: '2026-02-27',
      servers: ['https://api.ejemplo.test'],
      securitySchemes: ['bearerAuth: http/bearer'],
      permissions: ['CB_GET_ALL'],
      premium: true,
      responses: { '200': 'OK', '403': 'Sin permisos' },
    });
    expect(ops[0]?.params[0]).toEqual({
      name: 'limit',
      in: 'query',
      required: false,
      default: 10,
      maximum: 50,
    });
  });

  it('detecta páginas publicadas con OpenAPI vacío', () => {
    const markdown = '# OpenAPI definition\n\n```json\n{}\n```\n';
    expect(extractOperations(page, markdown)).toEqual({ ops: [], emptySpec: true });
  });
});

describe('renderProduct', () => {
  it('escapa barras verticales para no romper la tabla Markdown', () => {
    const markdown = renderProduct(
      'Restobar',
      [op({ product: 'Restobar', method: 'GET', path: '/x', summary: 'A | B' })],
      '2026-09-29',
    );
    expect(markdown).toContain('A \\| B');
  });
});

describe('productFile', () => {
  it('normaliza acentos y espacios', () => {
    expect(productFile('Documentos Electrónicos')).toBe('documentos-electronicos');
    expect(productFile('Nómina Sipe')).toBe('nomina-sipe');
  });
});
