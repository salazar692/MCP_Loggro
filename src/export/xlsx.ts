import { crc32, deflateRawSync } from 'node:zlib';

/**
 * Escritor mínimo de archivos Excel (.xlsx) sin dependencias: una hoja, fila de
 * encabezado en negrita y congelada. Ver docs/decisions.md, ADR-015.
 *
 * Los textos se guardan como texto literal (`inlineStr`): Excel nunca los
 * evalúa como fórmulas y conserva ceros a la izquierda en documentos y teléfonos.
 */
export type Cell = string | number | null | undefined;

export interface Sheet {
  /** Nombre de la hoja (máximo 31 caracteres, sin `[]:*?/\`). */
  name: string;
  header: string[];
  rows: Cell[][];
}

const MAX_CELL_CHARS = 32_767; // límite de Excel por celda
// Controles no permitidos en XML 1.0 (se conservan tabulador y saltos de línea).
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, '')
    .slice(0, MAX_CELL_CHARS)
    .replace(LONE_SURROGATE, '�')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function cellXml(ref: string, value: Cell, style: number): string {
  const s = style ? ` s="${style}"` : '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${value}</v></c>` : '';
  }
  if (value === null || value === undefined || value === '') return '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml({ header, rows }: Sheet): string {
  const all: Cell[][] = [header, ...rows];
  const widths = header.map((_, c) => {
    const longest = all.reduce((max, row) => Math.max(max, String(row[c] ?? '').length), 0);
    return Math.min(50, Math.max(8, longest + 2));
  });
  const cols = widths
    .map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  const data = all
    .map((row, r) => {
      const cells = row.map((v, c) => cellXml(`${columnName(c)}${r + 1}`, v, r === 0 ? 1 : 0));
      return `<row r="${r + 1}">${cells.join('')}</row>`;
    })
    .join('');
  return (
    `${XML_DECL}<worksheet xmlns="${NS_MAIN}">` +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${data}</sheetData></worksheet>`
  );
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_PKG_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_DOC_RELS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml';

const CONTENT_TYPES =
  `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  `<Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${CT}.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="${CT}.styles+xml"/>` +
  '</Types>';

const ROOT_RELS =
  `${XML_DECL}<Relationships xmlns="${NS_PKG_RELS}">` +
  `<Relationship Id="rId1" Type="${NS_DOC_RELS}/officeDocument" Target="xl/workbook.xml"/>` +
  '</Relationships>';

const WORKBOOK_RELS =
  `${XML_DECL}<Relationships xmlns="${NS_PKG_RELS}">` +
  `<Relationship Id="rId1" Type="${NS_DOC_RELS}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_DOC_RELS}/styles" Target="styles.xml"/>` +
  '</Relationships>';

// Estilo 0: normal. Estilo 1: negrita (encabezado).
const STYLES =
  `${XML_DECL}<styleSheet xmlns="${NS_MAIN}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function workbookXml(sheetName: string): string {
  return (
    `${XML_DECL}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_DOC_RELS}">` +
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
}

/** Genera el contenido de un archivo .xlsx con una sola hoja. */
export function buildXlsx(sheet: Sheet, createdAt = new Date()): Buffer {
  return zip(
    [
      ['[Content_Types].xml', CONTENT_TYPES],
      ['_rels/.rels', ROOT_RELS],
      ['xl/workbook.xml', workbookXml(sheet.name)],
      ['xl/_rels/workbook.xml.rels', WORKBOOK_RELS],
      ['xl/styles.xml', STYLES],
      ['xl/worksheets/sheet1.xml', sheetXml(sheet)],
    ],
    createdAt,
  );
}

// ---------------------------------------------------------------------------
// ZIP (formato de contenedor de .xlsx): entradas comprimidas con deflate.
// ---------------------------------------------------------------------------

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function zip(entries: [name: string, content: string][], modified: Date): Buffer {
  const { time, date } = dosDateTime(modified);
  const parts: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [entryName, content] of entries) {
    const name = Buffer.from(entryName, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const compressed = deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // firma de entrada local
    local.writeUInt16LE(20, 4); // versión necesaria (2.0)
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8); // método: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // firma del directorio central
    central.writeUInt16LE(20, 4); // versión que lo creó
    central.writeUInt16LE(20, 6); // versión necesaria
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42); // posición de la entrada local
    directory.push(central, name);

    offset += local.length + name.length + compressed.length;
  }
  const directorySize = directory.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // fin del directorio central
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}
