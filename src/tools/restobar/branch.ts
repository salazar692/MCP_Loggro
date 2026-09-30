import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { RestobarClient } from '../../loggro/restobar/client.ts';
import { READ_ONLY_ANNOTATIONS, runTool } from '../shared.ts';
import type { RestobarToolContext } from './context.ts';

const branchField = z
  .string()
  .min(1)
  .max(100)
  .optional()
  .describe(
    'Sucursal: nombre (p. ej. «Viva») o id de restobar_list_branches. Obligatoria si hay varias sucursales.',
  );

/** Parámetro `branch`, solo cuando el servidor atiende varias sucursales. */
export function branchInput(ctx: RestobarToolContext): { branch?: typeof branchField } {
  return ctx.restobar.multiBranch ? { branch: branchField } : {};
}

/** Cliente de Restobar de la sucursal pedida en los argumentos de la herramienta. */
export function restobarFor(ctx: RestobarToolContext, args: object): Promise<RestobarClient> {
  const { branch } = args as { branch?: string };
  return ctx.restobar.client(branch);
}

/** `restobar_list_branches`: solo existe cuando el servidor atiende varias sucursales. */
export function registerBranchTools(server: McpServer, ctx: RestobarToolContext): void {
  if (!ctx.restobar.multiBranch) return;
  server.registerTool(
    'restobar_list_branches',
    {
      title: 'Listar sucursales (Restobar)',
      description: [
        'Lista las sucursales de Restobar a las que tiene acceso este servidor (id y nombre). Las demás',
        'herramientas reciben la sucursal en «branch» (nombre o id). Si el usuario no dice la sucursal y hay',
        'varias, pregúntale o consulta cada una por separado; nunca sumes sucursales sin decirlo. Solo lectura.',
      ].join(' '),
      inputSchema: {},
      outputSchema: { branches: z.array(z.object({ id: z.string(), name: z.string() })) },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    () =>
      runTool(ctx.logger, 'restobar_list_branches', async () => ({
        branches: await ctx.restobar.listBranches(),
      })),
  );
}
