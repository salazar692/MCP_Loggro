import { z } from 'zod';

import { LoggroError } from './errors.ts';
import type { LogLevel } from './logging.ts';

/** Credenciales de Restobar: un token ya emitido o usuario y contraseña para `POST /login`. */
export type RestobarAuth =
  { mode: 'token'; token: string } | { mode: 'password'; email: string; password: string };

export interface Config {
  restobar: { baseUrl: string; auth: RestobarAuth };
  redactPersonalData: boolean;
  timeZone: string;
  logLevel: LogLevel;
}

export const DEFAULT_RESTOBAR_BASE_URL = 'https://api.pirpos.com';

// Variables vacías (p. ej. copiadas de .env.example) cuentan como no definidas.
const optionalText = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().optional(),
);

const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const EnvSchema = z.object({
  LOGGRO_RESTOBAR_TOKEN: optionalText,
  LOGGRO_RESTOBAR_EMAIL: optionalText,
  LOGGRO_RESTOBAR_PASSWORD: optionalText,
  LOGGRO_RESTOBAR_BASE_URL: optionalText.refine(
    (v) => v === undefined || (URL.canParse(v) && new URL(v).protocol === 'https:'),
    'debe ser una URL https://',
  ),
  LOGGRO_REDACT_PERSONAL_DATA: optionalText.refine(
    (v) => v === undefined || v === 'true' || v === 'false',
    'debe ser true o false',
  ),
  LOGGRO_TIMEZONE: optionalText.refine(
    (v) => v === undefined || isValidTimeZone(v),
    'no es una zona horaria IANA válida (p. ej. America/Bogota)',
  ),
  LOG_LEVEL: optionalText.refine(
    (v) => v === undefined || ['debug', 'info', 'warn', 'error'].includes(v),
    'debe ser debug, info, warn o error',
  ),
});

/**
 * Lee y valida la configuración desde variables de entorno.
 * Los mensajes de error nombran la variable, nunca su valor.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new LoggroError('config', `Configuración inválida. ${problems.join('; ')}`);
  }
  const e = parsed.data;

  const hasToken = e.LOGGRO_RESTOBAR_TOKEN !== undefined;
  const hasEmail = e.LOGGRO_RESTOBAR_EMAIL !== undefined;
  const hasPassword = e.LOGGRO_RESTOBAR_PASSWORD !== undefined;

  let auth: RestobarAuth;
  if (hasToken && (hasEmail || hasPassword)) {
    throw new LoggroError(
      'config',
      'Define LOGGRO_RESTOBAR_TOKEN o LOGGRO_RESTOBAR_EMAIL y LOGGRO_RESTOBAR_PASSWORD, no ambos.',
    );
  } else if (hasToken) {
    auth = { mode: 'token', token: stripBearer(e.LOGGRO_RESTOBAR_TOKEN) };
  } else if (hasEmail && hasPassword) {
    auth = {
      mode: 'password',
      email: e.LOGGRO_RESTOBAR_EMAIL ?? '',
      password: e.LOGGRO_RESTOBAR_PASSWORD ?? '',
    };
  } else {
    throw new LoggroError(
      'config',
      'Faltan credenciales de Restobar: define LOGGRO_RESTOBAR_TOKEN, o LOGGRO_RESTOBAR_EMAIL y LOGGRO_RESTOBAR_PASSWORD.',
    );
  }

  return {
    restobar: {
      baseUrl: (e.LOGGRO_RESTOBAR_BASE_URL ?? DEFAULT_RESTOBAR_BASE_URL).replace(/\/+$/, ''),
      auth,
    },
    redactPersonalData: e.LOGGRO_REDACT_PERSONAL_DATA === 'true',
    timeZone: e.LOGGRO_TIMEZONE ?? 'America/Bogota',
    logLevel: (e.LOG_LEVEL as LogLevel | undefined) ?? 'info',
  };
}

/** Acepta el token con o sin el prefijo «Bearer ». */
function stripBearer(token: string | undefined): string {
  return (token ?? '').replace(/^Bearer\s+/i, '');
}
