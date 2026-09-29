#!/usr/bin/env node
/**
 * MCP_Loggro: punto de entrada del servidor MCP (transporte stdio).
 * stdout es el canal del protocolo; todo log va a stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from './config.ts';
import { userMessage } from './errors.ts';
import { HttpClient } from './http/client.ts';
import {
  LoginTokenProvider,
  StaticTokenProvider,
  type TokenProvider,
} from './loggro/restobar/auth.ts';
import { RestobarClient } from './loggro/restobar/client.ts';
import { RESTOBAR_ALLOWLIST } from './loggro/restobar/operations.ts';
import { createLogger } from './logging.ts';
import { createServer } from './server.ts';
import { VERSION } from './version.ts';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const http = new HttpClient({
    baseUrl: config.restobar.baseUrl,
    allowlist: RESTOBAR_ALLOWLIST,
    logger,
  });
  const auth = config.restobar.auth;
  const tokens: TokenProvider =
    auth.mode === 'token'
      ? new StaticTokenProvider(auth.token)
      : new LoginTokenProvider(http, auth.email, auth.password);

  const server = createServer({
    restobar: new RestobarClient(http, tokens),
    redactPersonalData: config.redactPersonalData,
    timeZone: config.timeZone,
    exportDir: config.exportDir,
    logger,
  });
  await server.connect(new StdioServerTransport());
  logger.info('mcp-loggro iniciado', {
    version: VERSION,
    authMode: auth.mode,
    timeZone: config.timeZone,
    redactPersonalData: config.redactPersonalData,
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`mcp-loggro: ${userMessage(err)}\n`);
  process.exit(1);
});
