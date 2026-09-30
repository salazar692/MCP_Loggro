/**
 * Punto de entrada para usar MCP_Loggro como librería dentro de un servidor remoto propio (Node.js o
 * Deno, en cualquier hosting). Quien lo importa aporta el transporte HTTP y la fuente del token
 * (`TokenProvider`); el token nunca sale del servidor.
 *
 * Con `exportDir: null` no se registra `restobar_export_clients`: en un servidor remoto el archivo
 * quedaría en el servidor y no en el computador del usuario.
 */
export { createServer } from './server.ts';
export { LoggroError, userMessage, type LoggroErrorKind } from './errors.ts';
export { HttpClient } from './http/client.ts';
export type { TokenProvider } from './loggro/restobar/auth.ts';
export {
  BranchSource,
  resolveBranch,
  singleSource,
  type Branch,
  type RestobarSource,
} from './loggro/restobar/branches.ts';
export { RestobarClient } from './loggro/restobar/client.ts';
export { RESTOBAR_ALLOWLIST } from './loggro/restobar/operations.ts';
export { createLogger, silentLogger, type Logger } from './logging.ts';
export type { RestobarToolContext } from './tools/restobar/context.ts';
export { VERSION } from './version.ts';
