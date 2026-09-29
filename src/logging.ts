export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SECRET_KEY = /authorization|token|password|secret|cookie|api[-_]?key/i;
const REDACTED = '[REDACTED]';

/** Sustituye por `[REDACTED]` cualquier campo cuyo nombre sugiera un secreto. */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      SECRET_KEY.test(k) ? REDACTED : redactSecrets(v, depth + 1),
    ]),
  );
}

/**
 * Logger JSON por líneas que escribe SOLO en stderr: con transporte stdio,
 * stdout es el canal del protocolo MCP.
 */
export function createLogger(
  level: LogLevel,
  write: (line: string) => void = (line) => process.stderr.write(`${line}\n`),
): Logger {
  const min = LEVELS[level];
  const log = (lvl: LogLevel, msg: string, fields?: LogFields): void => {
    if (LEVELS[lvl] < min) return;
    const extra = fields ? (redactSecrets(fields) as LogFields) : {};
    write(JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...extra }));
  };
  return {
    debug: (msg, fields) => log('debug', msg, fields),
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
  };
}

export const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };
