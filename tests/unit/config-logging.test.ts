import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config.ts';
import { createLogger, redactSecrets } from '../../src/logging.ts';

describe('loadConfig', () => {
  it('usa el modo token y quita el prefijo Bearer', () => {
    const config = loadConfig({ LOGGRO_RESTOBAR_TOKEN: 'Bearer abc' });
    expect(config.restobar.auth).toEqual({ mode: 'token', token: 'abc' });
    expect(config.restobar.baseUrl).toBe('https://api.pirpos.com');
    expect(config.timeZone).toBe('America/Bogota');
    expect(config.redactPersonalData).toBe(false);
  });

  it('usa el modo usuario y clave; las variables vacías cuentan como no definidas', () => {
    const config = loadConfig({
      LOGGRO_RESTOBAR_TOKEN: '',
      LOGGRO_RESTOBAR_EMAIL: 'a@b.test',
      LOGGRO_RESTOBAR_PASSWORD: 'secreta',
    });
    expect(config.restobar.auth.mode).toBe('password');
  });

  it('rechaza ambos modos a la vez, la falta de credenciales y URLs sin https', () => {
    expect(() =>
      loadConfig({ LOGGRO_RESTOBAR_TOKEN: 't', LOGGRO_RESTOBAR_EMAIL: 'a@b.test' }),
    ).toThrow(/no ambos/);
    expect(() => loadConfig({})).toThrow(/Faltan credenciales/);
    expect(() =>
      loadConfig({ LOGGRO_RESTOBAR_TOKEN: 't', LOGGRO_RESTOBAR_BASE_URL: 'http://x.test' }),
    ).toThrow(/https/);
  });

  it('nunca incluye el valor de un secreto en el mensaje de error', () => {
    try {
      loadConfig({ LOGGRO_RESTOBAR_TOKEN: 'super-secreto', LOG_LEVEL: 'ruidoso' });
      expect.unreachable();
    } catch (err) {
      expect(String(err)).not.toContain('super-secreto');
      expect(String(err)).toContain('LOG_LEVEL');
    }
  });
});

describe('logging', () => {
  it('redacta campos con nombre de secreto a cualquier profundidad', () => {
    expect(
      redactSecrets({ op: 'x', headers: { Authorization: 'Bearer t' }, tokenCurrent: 't' }),
    ).toEqual({ op: 'x', headers: { Authorization: '[REDACTED]' }, tokenCurrent: '[REDACTED]' });
  });

  it('filtra por nivel y escribe JSON por línea', () => {
    const lines: string[] = [];
    const logger = createLogger('warn', (l) => lines.push(l));
    logger.info('oculto');
    logger.warn('visible', { password: 'p' });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      level: 'warn',
      msg: 'visible',
      password: '[REDACTED]',
    });
  });
});
