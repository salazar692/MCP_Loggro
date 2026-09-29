import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { LoggroError } from '../../errors.ts';
import { saveNewFile } from '../../export/save.ts';
import { buildXlsx, type Cell } from '../../export/xlsx.ts';
import type { RestobarClient } from '../../loggro/restobar/client.ts';
import { type Client, clientCity } from '../../loggro/restobar/schemas.ts';
import {
  LOCAL_EXPORT_ANNOTATIONS,
  READ_ONLY_ANNOTATIONS,
  UNTRUSTED_NOTE,
  formatLocal,
  runTool,
} from '../shared.ts';
import type { RestobarToolContext } from './context.ts';

/*
 * Herramientas para TODOS los clientes: resumen y exportación a Excel. Descargan
 * los clientes por lotes sin pasarlos por la conversación (docs/decisions.md, ADR-015).
 */

/** Clientes por solicitud. Restobar admite hasta 10 000 en GET /clients (inventario de Restobar). */
export const BULK_PAGE_SIZE = 500;
/** Máximo de clientes por descarga completa (100 solicitudes). */
export const MAX_BULK_ROWS = 50_000;

export interface AllClients {
  clients: Client[];
  reportedTotal: number | null;
  /** `false` si Restobar entregó menos clientes de los que informó. */
  complete: boolean;
  requests: number;
}

function tooMany(total: number | null): LoggroError {
  const count = total === null ? `más de ${MAX_BULK_ROWS}` : String(total);
  return new LoggroError(
    'export',
    `Hay ${count} clientes y el máximo por descarga es ${MAX_BULK_ROWS}. Usa search para dividirla en partes.`,
  );
}

/** Descarga todos los clientes (o los que coinciden con `filter`) por lotes, en secuencia. */
export async function fetchAllClients(
  restobar: RestobarClient,
  filter?: string,
): Promise<AllClients> {
  const byId = new Map<string, Client>();
  let reportedTotal: number | null = null;
  let requests = 0;
  for (let page = 0; ; page++) {
    const result = await restobar.listClients({ page, limit: BULK_PAGE_SIZE, filter });
    requests++;
    if (page === 0) {
      reportedTotal = result.count;
      if (reportedTotal !== null && reportedTotal > MAX_BULK_ROWS) throw tooMany(reportedTotal);
    }
    // Sin `_id` no se puede deduplicar: se conserva cada registro.
    for (const c of result.data) byId.set(c._id || `sin-id-${byId.size}`, c);
    const fetched = (page + 1) * BULK_PAGE_SIZE;
    if (result.data.length < BULK_PAGE_SIZE) break;
    if (reportedTotal !== null && fetched >= reportedTotal) break;
    if (fetched >= MAX_BULK_ROWS) throw tooMany(null);
  }
  const clients = [...byId.values()];
  return {
    clients,
    reportedTotal,
    complete: reportedTotal === null || clients.length >= reportedTotal,
    requests,
  };
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

const hasText = (v: string | null | undefined): boolean => typeof v === 'string' && v.trim() !== '';

function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Los `n` meses (YYYY-MM) que terminan en `current`, del más antiguo al más reciente. */
function monthsEndingIn(current: string, n: number): string[] {
  const [year = 1970, month = 1] = current.split('-').map(Number);
  return Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(year, month - 1 - (n - 1 - i), 1)).toISOString().slice(0, 7),
  );
}

const countOut = (key: string) => z.array(z.object({ [key]: z.string(), count: z.number() }));

const SummaryOut = {
  clients: z.number().describe('Clientes analizados.'),
  reportedTotal: z.number().nullable().describe('Total que informó Restobar.'),
  complete: z.boolean().describe('false si Restobar entregó menos clientes de los que informó.'),
  companies: z.number(),
  individuals: z.number().describe('Clientes no marcados como empresa.'),
  withEmail: z.number(),
  withPhone: z.number(),
  withDocument: z.number(),
  withAddress: z.number(),
  withBirthdate: z.number(),
  withLoyaltyPoints: z.number(),
  totalLoyaltyPoints: z.number(),
  newClientsLast12Months: countOut('month').describe('Clientes creados por mes (YYYY-MM).'),
  newClientsByYear: countOut('year'),
  topCities: countOut('city').describe('Las 10 ciudades con más clientes.'),
  restobarRequests: z.number().describe('Solicitudes hechas a Restobar.'),
};

export function summarizeClients(all: AllClients, timeZone: string, now = new Date()) {
  const { clients } = all;
  const count = (test: (c: Client) => boolean): number => clients.filter(test).length;
  const byMonth = new Map<string, number>();
  const byYear = new Map<string, number>();
  const cities = new Map<string, { city: string; count: number }>();
  for (const c of clients) {
    const created = parseInstant(c.createdOn);
    if (created) {
      const { date } = formatLocal(created, timeZone);
      byMonth.set(date.slice(0, 7), (byMonth.get(date.slice(0, 7)) ?? 0) + 1);
      byYear.set(date.slice(0, 4), (byYear.get(date.slice(0, 4)) ?? 0) + 1);
    }
    const city = clientCity(c)?.trim();
    if (city) {
      // «Bogotá», «bogota» y «BOGOTA» cuentan como la misma ciudad.
      const key = city.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      const entry = cities.get(key) ?? { city, count: 0 };
      entry.count++;
      cities.set(key, entry);
    }
  }
  const currentMonth = formatLocal(now, timeZone).date.slice(0, 7);
  const companies = count((c) => c.isSocialReason === true);
  return {
    clients: clients.length,
    reportedTotal: all.reportedTotal,
    complete: all.complete,
    companies,
    individuals: clients.length - companies,
    withEmail: count((c) => hasText(c.email)),
    withPhone: count((c) => hasText(c.phone)),
    withDocument: count((c) => hasText(c.document)),
    withAddress: count((c) => hasText(c.address)),
    withBirthdate: count((c) => hasText(c.birthdate)),
    withLoyaltyPoints: count((c) => (c.points ?? 0) > 0),
    totalLoyaltyPoints: clients.reduce((sum, c) => sum + (c.points ?? 0), 0),
    newClientsLast12Months: monthsEndingIn(currentMonth, 12).map((month) => ({
      month,
      count: byMonth.get(month) ?? 0,
    })),
    newClientsByYear: [...byYear]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, n]) => ({ year, count: n })),
    topCities: [...cities.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    restobarRequests: all.requests,
  };
}

// ---------------------------------------------------------------------------
// Exportación a Excel
// ---------------------------------------------------------------------------

interface Column {
  header: string;
  /** Dato personal: se omite si la redacción está activa (LOGGRO_REDACT_PERSONAL_DATA). */
  personal: boolean;
  value: (c: Client, timeZone: string) => Cell;
}

const COLUMNS: Column[] = [
  { header: 'Nombre', personal: false, value: (c) => c.name },
  { header: 'Apellido', personal: false, value: (c) => c.lastName },
  {
    header: 'Empresa',
    personal: false,
    value: (c) => (c.isSocialReason == null ? null : c.isSocialReason ? 'Sí' : 'No'),
  },
  { header: 'Tipo de documento', personal: false, value: (c) => c.documentName },
  { header: 'Documento', personal: true, value: (c) => c.document },
  {
    header: 'DV',
    personal: true,
    value: (c) => (c.checkDigit == null ? null : String(c.checkDigit)),
  },
  { header: 'Correo', personal: true, value: (c) => c.email },
  { header: 'Teléfono', personal: true, value: (c) => c.phone },
  { header: 'Dirección', personal: true, value: (c) => c.address },
  { header: 'Ciudad', personal: false, value: (c) => clientCity(c) },
  { header: 'Departamento', personal: false, value: (c) => c.cityDetail?.stateName },
  {
    header: 'Contacto',
    personal: true,
    value: (c) =>
      [c.contact?.firstName, c.contact?.lastName].filter((v) => v?.trim()).join(' ') || null,
  },
  { header: 'Correo de contacto', personal: true, value: (c) => c.contact?.email },
  { header: 'Teléfono de contacto', personal: true, value: (c) => c.contact?.phone },
  {
    header: 'Fecha de nacimiento',
    personal: true,
    // Si viene como instante ISO, se toma solo la fecha (convertirla de zona correría el día).
    value: (c) => /^\d{4}-\d{2}-\d{2}/.exec(c.birthdate ?? '')?.[0] ?? c.birthdate,
  },
  { header: 'Puntos', personal: false, value: (c) => c.points },
  {
    header: 'Creado',
    personal: false,
    value: (c, tz) => {
      const created = parseInstant(c.createdOn);
      if (!created) return c.createdOn;
      const { date, time } = formatLocal(created, tz);
      return `${date} ${time.slice(0, 5)}`;
    },
  },
  { header: 'ID Restobar', personal: false, value: (c) => c._id },
];

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

const searchInput = z
  .string()
  .min(1)
  .optional()
  .describe('Solo clientes cuyo nombre, apellido, documento o teléfono contengan este texto.');

export function registerClientBulkTools(server: McpServer, ctx: RestobarToolContext): void {
  server.registerTool(
    'restobar_clients_summary',
    {
      title: 'Resumen de clientes (Restobar)',
      description: [
        'Resume TODOS los clientes del negocio en Restobar (o los que coinciden con search) sin traerlos a la',
        'conversación: total, empresas, cuántos tienen correo, teléfono o documento, clientes nuevos por mes y',
        'por año, ciudades principales y puntos de fidelización. Úsala para preguntas de cifras sobre clientes.',
        `Descarga los clientes en lotes de ${BULK_PAGE_SIZE} (una solicitud a Restobar por lote): con miles de`,
        'clientes puede tardar. Solo lectura.',
        UNTRUSTED_NOTE,
      ].join(' '),
      inputSchema: { search: searchInput },
      outputSchema: SummaryOut,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) =>
      runTool(ctx.logger, 'restobar_clients_summary', async () => {
        const all = await fetchAllClients(ctx.restobar, args.search);
        return summarizeClients(all, ctx.timeZone);
      }),
  );

  const columns = COLUMNS.filter((col) => !(ctx.redactPersonalData && col.personal));
  server.registerTool(
    'restobar_export_clients',
    {
      title: 'Exportar clientes a Excel (Restobar)',
      description: [
        'Exporta TODOS los clientes del negocio en Restobar (o los que coinciden con search) a un archivo Excel',
        '(.xlsx) nuevo en el computador donde está instalado este servidor MCP. Los datos NO pasan por la',
        'conversación: devuelve solo la ruta del archivo y el número de filas. Úsala cuando el usuario pida la',
        'lista completa de clientes o un listado demasiado grande para mostrarlo en el chat.',
        ctx.redactPersonalData
          ? 'Este servidor oculta datos personales: el archivo no incluye documento, correo, teléfono, dirección ni fecha de nacimiento.'
          : 'El archivo incluye datos de contacto e identificación.',
        'En Restobar es solo lectura; en el computador crea un archivo nuevo y nunca sobrescribe otro.',
        'Dile al usuario la ruta exacta del archivo; no describas su contenido, porque no lo conoces.',
      ].join(' '),
      inputSchema: { search: searchInput },
      outputSchema: {
        file: z.string().describe('Ruta absoluta del archivo creado.'),
        rows: z.number().describe('Clientes exportados.'),
        reportedTotal: z.number().nullable().describe('Total que informó Restobar.'),
        complete: z
          .boolean()
          .describe('false si Restobar entregó menos clientes de los que informó.'),
        columns: z.array(z.string()),
        personalDataIncluded: z.boolean(),
        restobarRequests: z.number().describe('Solicitudes hechas a Restobar.'),
      },
      annotations: LOCAL_EXPORT_ANNOTATIONS,
    },
    (args) =>
      runTool(ctx.logger, 'restobar_export_clients', async () => {
        const all = await fetchAllClients(ctx.restobar, args.search);
        const now = new Date();
        const workbook = buildXlsx(
          {
            name: 'Clientes',
            header: columns.map((col) => col.header),
            rows: all.clients.map((c) => columns.map((col) => col.value(c, ctx.timeZone))),
          },
          now,
        );
        const { date, time } = formatLocal(now, ctx.timeZone);
        const file = await saveNewFile(
          ctx.exportDir,
          `restobar-clientes-${date}_${time.replace(/:/g, '-')}`,
          'xlsx',
          workbook,
        );
        ctx.logger.info('export.saved', {
          tool: 'restobar_export_clients',
          rows: all.clients.length,
        });
        return {
          file,
          rows: all.clients.length,
          reportedTotal: all.reportedTotal,
          complete: all.complete,
          columns: columns.map((col) => col.header),
          personalDataIncluded: !ctx.redactPersonalData,
          restobarRequests: all.requests,
        };
      }),
  );
}
