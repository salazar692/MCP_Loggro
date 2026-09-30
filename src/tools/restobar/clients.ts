import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  READ_ONLY_ANNOTATIONS,
  UNTRUSTED_NOTE,
  pageInfo,
  paginationInput,
  paginationOutput,
  personal,
  runTool,
  toRestobarPage,
} from '../shared.ts';
import { clientCity } from '../../loggro/restobar/schemas.ts';
import type { RestobarToolContext } from './context.ts';

const nullableText = z.string().nullable();

const ClientOut = z.object({
  id: z.string(),
  name: nullableText,
  lastName: nullableText,
  isCompany: z.boolean().nullable().describe('Razón social (empresa).'),
  documentType: nullableText,
  document: nullableText,
  checkDigit: nullableText,
  email: nullableText,
  phone: nullableText,
  address: nullableText,
  city: nullableText,
  birthdate: nullableText,
  loyaltyPoints: z.number().nullable(),
  createdOn: nullableText,
});

export function registerClientTools(server: McpServer, ctx: RestobarToolContext): void {
  const redact = ctx.redactPersonalData;
  server.registerTool(
    'restobar_list_clients',
    {
      title: 'Buscar clientes (Restobar)',
      description: [
        'Busca clientes del negocio en Restobar por nombre, apellido, documento o teléfono, ordenados por nombre.',
        'Sin búsqueda, lista todos por páginas. Incluye datos de contacto e identificación',
        redact
          ? '(en este servidor están ocultos: se devuelven como null).'
          : '(datos personales: úsalos solo para lo que pidió el usuario).',
        'El id sirve para filtrar facturas con restobar_list_invoices. pagination.total indica cuántos',
        'clientes hay. Para la lista completa usa restobar_export_clients; para cifras, restobar_clients_summary.',
        'Solo lectura.',
        UNTRUSTED_NOTE,
      ].join(' '),
      inputSchema: {
        search: z
          .string()
          .min(1)
          .optional()
          .describe('Texto a buscar en nombre, apellido, documento o teléfono.'),
        ...paginationInput,
      },
      outputSchema: { clients: z.array(ClientOut), pagination: paginationOutput },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) =>
      runTool(ctx.logger, 'restobar_list_clients', async () => {
        const page = await ctx.restobar.listClients({
          ...toRestobarPage(args.page, args.pageSize),
          filter: args.search,
        });
        return {
          clients: page.data.map((c) => ({
            id: c._id,
            name: c.name ?? null,
            lastName: c.lastName ?? null,
            isCompany: c.isSocialReason ?? null,
            documentType: c.documentName ?? null,
            document: personal(c.document ?? null, redact),
            checkDigit: personal(c.checkDigit == null ? null : String(c.checkDigit), redact),
            email: personal(c.email ?? null, redact),
            phone: personal(c.phone ?? null, redact),
            address: personal(c.address ?? null, redact),
            city: clientCity(c),
            birthdate: personal(c.birthdate ?? null, redact),
            loyaltyPoints: c.points ?? null,
            createdOn: c.createdOn ?? null,
          })),
          pagination: pageInfo(
            args.page,
            args.pageSize,
            page.count,
            page.data.length,
            'No recorras todas las páginas para armar el listado en la conversación: para la lista completa usa restobar_export_clients (archivo Excel en el computador del usuario), para cifras usa restobar_clients_summary, o afina con search.',
          ),
        };
      }),
  );
}
