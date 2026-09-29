import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { saveNewFile } from '../../src/export/save.ts';
import { buildXlsx, columnName } from '../../src/export/xlsx.ts';
import { unzip } from '../helpers/unzip.ts';

describe('buildXlsx', () => {
  const sheet = (rows: (string | number | null)[][]) =>
    unzip(buildXlsx({ name: 'Clientes', header: ['Nombre', 'Teléfono', 'Puntos'], rows })).get(
      'xl/worksheets/sheet1.xml',
    ) ?? '';

  it('genera un paquete .xlsx completo y con CRC válido', () => {
    const files = unzip(buildXlsx({ name: 'Clientes', header: ['A'], rows: [['x']] }));
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(files.get('xl/workbook.xml')).toContain('<sheet name="Clientes"');
  });

  it('guarda textos como texto literal (sin fórmulas, con ceros a la izquierda)', () => {
    const xml = sheet([['=HYPERLINK("x")', '0300123', 15]]);
    expect(xml).toContain(
      '<c r="A2" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;x&quot;)</t>',
    );
    expect(xml).toContain('<t xml:space="preserve">0300123</t>');
    expect(xml).toContain('<c r="C2"><v>15</v></c>');
    expect(xml).not.toContain('<f>');
  });

  it('escapa XML, quita caracteres inválidos y omite celdas vacías', () => {
    const xml = sheet([['<b>&\u0001', null, null]]);
    expect(xml).toContain('&lt;b&gt;&amp;</t>');
    expect(xml).not.toContain('\u0001');
    expect(xml).toContain('<row r="2"><c r="A2"');
    expect(xml).not.toContain('r="B2"');
  });

  it('marca el encabezado en negrita y lo congela', () => {
    const xml = sheet([]);
    expect(xml).toContain('<c r="A1" s="1" t="inlineStr">');
    expect(xml).toContain('state="frozen"');
  });

  it('nombra columnas como Excel', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });
});

describe('saveNewFile', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('crea la carpeta y nunca sobrescribe un archivo existente', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mcp-loggro-test-'));
    const target = path.join(dir, 'sub');
    const first = await saveNewFile(target, 'reporte', 'xlsx', Buffer.from('uno'));
    const second = await saveNewFile(target, 'reporte', 'xlsx', Buffer.from('dos'));
    expect(first).toBe(path.join(target, 'reporte.xlsx'));
    expect(second).toBe(path.join(target, 'reporte-2.xlsx'));
    expect(await readFile(first, 'utf8')).toBe('uno');
    if (process.platform !== 'win32') {
      expect((await stat(first)).mode & 0o777).toBe(0o600);
    }
  });

  it('explica el error si no puede escribir, sin exponer datos', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mcp-loggro-test-'));
    const blocker = path.join(dir, 'archivo');
    await writeFile(blocker, 'x');
    await expect(
      saveNewFile(path.join(blocker, 'sub'), 'r', 'xlsx', Buffer.from('')),
    ).rejects.toMatchObject({
      kind: 'export',
      message: expect.stringContaining('LOGGRO_EXPORT_DIR') as unknown,
    });
  });
});
