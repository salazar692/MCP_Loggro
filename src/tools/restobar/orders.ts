import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  READ_ONLY_ANNOTATIONS,
  UNTRUSTED_NOTE,
  dateInput,
  dayRangeToIso,
  joinName,
  pageInfo,
  paginationInput,
  paginationOutput,
  runTool,
  toRestobarPage,
} from '../shared.ts';
import { branchInput, restobarFor } from './branch.ts';
import type { RestobarToolContext } from './context.ts';

const nullableText = z.string().nullable();

const OrderOut = z.object({
  id: z.string(),
  product: z.object({ id: nullableText, name: nullableText }).nullable(),
  table: z.object({ id: nullableText, name: nullableText }).nullable(),
  seller: nullableText.describe('Nombre del mesero o vendedor.'),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  total: z.number().nullable(),
  status: nullableText.describe('Espera, Cocina, Listo, Entregado o Cancelado.'),
  kitchenStatus: nullableText,
  complementary: z.boolean().nullable().describe('Pedido de cortesía.'),
  cancelReason: nullableText,
  createdOn: nullableText,
});

export function registerOrderTools(server: McpServer, ctx: RestobarToolContext): void {
  server.registerTool(
    'restobar_list_orders',
    {
      title: 'Listar pedidos (Restobar)',
      description: [
        'Lista pedidos del negocio en Restobar. Cada pedido es un producto con su cantidad, mesa, vendedor y estado.',
        'Filtros opcionales: rango de fechas (YYYY-MM-DD, en la zona horaria del negocio), estado, mesa y producto',
        '(productId de restobar_list_products). Solo lectura.',
        UNTRUSTED_NOTE,
      ].join(' '),
      inputSchema: {
        ...branchInput(ctx),
        dateFrom: dateInput.optional().describe('Desde esta fecha, inclusive (YYYY-MM-DD).'),
        dateTo: dateInput.optional().describe('Hasta esta fecha, inclusive (YYYY-MM-DD).'),
        status: z.enum(['Espera', 'Cocina', 'Listo', 'Entregado', 'Cancelado']).optional(),
        tableId: z.string().min(1).optional().describe('ID de la mesa.'),
        productId: z.string().min(1).optional().describe('ID del producto.'),
        ...paginationInput,
      },
      outputSchema: { orders: z.array(OrderOut), pagination: paginationOutput },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) =>
      runTool(ctx.logger, 'restobar_list_orders', async () => {
        const range = dayRangeToIso(args.dateFrom, args.dateTo, ctx.timeZone);
        const page = await (
          await restobarFor(ctx, args)
        ).listOrders({
          ...toRestobarPage(args.page, args.pageSize),
          dateInit: range.start,
          dateEnd: range.end,
          status: args.status,
          tableId: args.tableId,
          product: args.productId,
        });
        return {
          orders: page.data.map((o) => ({
            id: o._id,
            product: o.product ? { id: o.product._id ?? null, name: o.product.name ?? null } : null,
            table: o.table ? { id: o.table._id ?? null, name: o.table.name ?? null } : null,
            seller: joinName(o.seller?.name, o.seller?.lastName),
            quantity: o.quantity ?? null,
            unitPrice: o.unit_price ?? null,
            total: o.total ?? null,
            status: o.status ?? null,
            kitchenStatus: o.statusKitchen ?? null,
            complementary: o.complementary?.isComplementary ?? null,
            cancelReason: o.causeCancel ?? null,
            createdOn: o.createdOn ?? null,
          })),
          pagination: pageInfo(
            args.page,
            args.pageSize,
            page.count,
            page.data.length,
            'No recorras todas las páginas: afina con fechas, estado, mesa o producto.',
          ),
        };
      }),
  );
}
