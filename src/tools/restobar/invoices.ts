import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Invoice } from '../../loggro/restobar/schemas.ts';
import {
  READ_ONLY_ANNOTATIONS,
  UNTRUSTED_NOTE,
  dateInput,
  dayRangeToIso,
  pageInfo,
  paginationInput,
  paginationOutput,
  personal,
  runTool,
  toRestobarPage,
} from '../shared.ts';
import type { RestobarToolContext } from './context.ts';

const nullableText = z.string().nullable();

const InvoiceSummary = z.object({
  id: z.string(),
  prefix: nullableText,
  number: nullableText,
  status: nullableText.describe('Pendiente, Pagada o Anulada.'),
  type: nullableText.describe('Normal o FacturaElectronica.'),
  total: z.number().nullable(),
  totalPaid: z.number().nullable(),
  createdOn: nullableText,
  client: z.object({ id: nullableText, name: nullableText, phone: nullableText }).nullable(),
  table: z.object({ id: nullableText, name: nullableText }).nullable(),
  dianState: nullableText.describe('Estado de la factura electrónica ante la DIAN, si aplica.'),
});

const InvoiceDetail = InvoiceSummary.extend({
  products: z.array(
    z.object({
      id: nullableText,
      name: nullableText,
      quantity: z.number().nullable(),
      unitPrice: z.number().nullable(),
    }),
  ),
  cashier: nullableText,
  isDelivery: z.boolean().nullable(),
  deliveryProvider: nullableText,
  deliveryCost: z.number().nullable(),
  creditDueDate: nullableText,
});

function toSummary(inv: Invoice, redact: boolean): z.infer<typeof InvoiceSummary> {
  return {
    id: inv._id,
    prefix: inv.invoicePrefix ?? null,
    number: inv.number == null ? null : String(inv.number),
    status: inv.status ?? null,
    type: inv.type ?? null,
    total: inv.total ?? null,
    totalPaid: inv.totalPaid ?? null,
    createdOn: inv.createdOn ?? null,
    client: inv.client
      ? {
          id: inv.client.idInternal ?? null,
          name: inv.client.name ?? null,
          phone: personal(inv.client.phone ?? null, redact),
        }
      : null,
    table: inv.table ? { id: inv.table.idInternal ?? null, name: inv.table.name ?? null } : null,
    dianState: inv.eInvoice?.DIAN?.dianState ?? null,
  };
}

function toDetail(inv: Invoice, redact: boolean): z.infer<typeof InvoiceDetail> {
  return {
    ...toSummary(inv, redact),
    products: (inv.products ?? []).map((p) => ({
      id: p.idInternal ?? null,
      name: p.name ?? null,
      quantity: p.quantity ?? null,
      unitPrice: p.price ?? null,
    })),
    cashier: inv.cashier?.name ?? null,
    isDelivery: inv.delivery?.isDelivery ?? null,
    deliveryProvider: inv.delivery?.deliveryProvider ?? null,
    deliveryCost: inv.deliveryCost ?? null,
    creditDueDate: inv.credit?.dueDate ?? null,
  };
}

export function registerInvoiceTools(server: McpServer, ctx: RestobarToolContext): void {
  server.registerTool(
    'restobar_list_invoices',
    {
      title: 'Listar facturas (Restobar)',
      description: [
        'Lista facturas del negocio en Restobar (Loggro), de la más reciente a la más antigua.',
        'Filtros opcionales: rango de fechas (YYYY-MM-DD, en la zona horaria del negocio), estado, tipo,',
        'cliente (clientId obtenido con restobar_list_clients), número de factura y método de pago',
        '(nombre exacto de restobar_list_payment_methods). Devuelve un resumen por factura;',
        'usa restobar_get_invoice para ver productos y detalle. Solo lectura.',
        UNTRUSTED_NOTE,
      ].join(' '),
      inputSchema: {
        dateFrom: dateInput.optional().describe('Desde esta fecha, inclusive (YYYY-MM-DD).'),
        dateTo: dateInput.optional().describe('Hasta esta fecha, inclusive (YYYY-MM-DD).'),
        status: z.enum(['Pendiente', 'Pagada', 'Anulada', 'Todos']).optional(),
        type: z.enum(['Normal', 'FacturaElectronica']).optional(),
        clientId: z.string().min(1).optional().describe('ID del cliente en Restobar.'),
        number: z.string().min(1).optional().describe('Número de la factura.'),
        paymentMethodName: z.string().min(1).optional().describe('Nombre del método de pago.'),
        ...paginationInput,
      },
      outputSchema: { invoices: z.array(InvoiceSummary), pagination: paginationOutput },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) =>
      runTool(ctx.logger, 'restobar_list_invoices', async () => {
        const range = dayRangeToIso(args.dateFrom, args.dateTo, ctx.timeZone);
        const page = await ctx.restobar.listInvoices({
          ...toRestobarPage(args.page, args.pageSize),
          dateInit: range.start,
          dateEnd: range.end,
          status: args.status,
          type: args.type,
          clientId: args.clientId,
          number: args.number,
          paymentMethodName: args.paymentMethodName,
        });
        return {
          invoices: page.data.map((inv) => toSummary(inv, ctx.redactPersonalData)),
          pagination: pageInfo(
            args.page,
            args.pageSize,
            page.count,
            page.data.length,
            'No recorras todas las páginas para contar o sumar: total ya es el conteo y restobar_sales_by_day da las ventas por día. Para revisar facturas concretas, afina con fechas, estado, cliente o método de pago.',
          ),
        };
      }),
  );

  server.registerTool(
    'restobar_get_invoice',
    {
      title: 'Ver factura (Restobar)',
      description: [
        'Muestra el detalle de una factura de Restobar por su ID (campo id de restobar_list_invoices):',
        'productos con cantidad y precio unitario, cajero, domicilio, crédito y estado ante la DIAN. Solo lectura.',
        UNTRUSTED_NOTE,
      ].join(' '),
      inputSchema: {
        id: z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,64}$/, 'ID con formato inválido.')
          .describe('ID de la factura en Restobar.'),
      },
      outputSchema: { invoice: InvoiceDetail },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) =>
      runTool(ctx.logger, 'restobar_get_invoice', async () => {
        const invoice = await ctx.restobar.getInvoice(args.id);
        return { invoice: toDetail(invoice, ctx.redactPersonalData) };
      }),
  );
}
