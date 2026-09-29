import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerCatalogTools } from './catalog.ts';
import { registerClientTools } from './clients.ts';
import type { RestobarToolContext } from './context.ts';
import { registerInvoiceTools } from './invoices.ts';
import { registerOrderTools } from './orders.ts';
import { registerSalesTools } from './sales.ts';

export type { RestobarToolContext } from './context.ts';

export function registerRestobarTools(server: McpServer, ctx: RestobarToolContext): void {
  registerInvoiceTools(server, ctx);
  registerCatalogTools(server, ctx);
  registerOrderTools(server, ctx);
  registerClientTools(server, ctx);
  registerSalesTools(server, ctx);
}
