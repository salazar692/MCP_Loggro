import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { READ_ONLY_ANNOTATIONS, dateInput, dayRangeToIso, runTool } from '../shared.ts';
import { branchInput, restobarFor } from './branch.ts';
import type { RestobarToolContext } from './context.ts';

export function registerSalesTools(server: McpServer, ctx: RestobarToolContext): void {
  server.registerTool(
    'restobar_sales_by_day',
    {
      title: 'Ventas por día (Restobar)',
      description: [
        'Total facturado por día en Restobar para un rango de fechas (YYYY-MM-DD, ambos inclusive, máximo 93 días).',
        'Útil para «¿cuánto vendimos esta semana?». Requiere que el usuario tenga el permiso de estadísticas de',
        'ventas (ST_GET_SALES). Solo lectura.',
      ].join(' '),
      inputSchema: {
        ...branchInput(ctx),
        dateFrom: dateInput.describe('Desde esta fecha, inclusive (YYYY-MM-DD).'),
        dateTo: dateInput.describe('Hasta esta fecha, inclusive (YYYY-MM-DD).'),
      },
      outputSchema: {
        days: z.array(
          z.object({
            date: z.string().nullable(),
            total: z.number().nullable(),
            invoices: z.number().nullable().describe('Número de facturas del día.'),
          }),
        ),
        grandTotal: z.number().describe('Suma de los totales diarios.'),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) =>
      runTool(ctx.logger, 'restobar_sales_by_day', async () => {
        const range = dayRangeToIso(args.dateFrom, args.dateTo, ctx.timeZone);
        const days = await (
          await restobarFor(ctx, args)
        ).salesByDay({
          dateInitISO: range.start ?? '',
          dateEndISO: range.end ?? '',
        });
        const rows = days.map((d) => ({
          date: d._id?.dayOfMonth ?? null,
          total: d.total ?? null,
          invoices: d.count ?? null,
        }));
        return { days: rows, grandTotal: rows.reduce((sum, d) => sum + (d.total ?? 0), 0) };
      }),
  );
}
