import { z } from 'zod';

import { LoggroError } from '../../errors.ts';
import { HttpStatusError, type HttpClient } from '../../http/client.ts';
import { RESTOBAR_OPERATIONS } from './operations.ts';

/** Fuente del token Bearer de Restobar. El token nunca sale de este módulo salvo hacia el HTTP. */
export interface TokenProvider {
  getToken(): Promise<string>;
  /** Descarta `token` si es el vigente. Devuelve `true` si es posible obtener uno nuevo. */
  invalidate(token: string): boolean;
}

/** Modo token (`LOGGRO_RESTOBAR_TOKEN`): nunca hace login. */
export class StaticTokenProvider implements TokenProvider {
  readonly #token: string;

  constructor(token: string) {
    this.#token = token;
  }

  getToken(): Promise<string> {
    return Promise.resolve(this.#token);
  }

  invalidate(): boolean {
    return false;
  }
}

const LoginResponse = z.object({ tokenCurrent: z.string().min(1) });

/**
 * Modo usuario y contraseña: `POST /login` perezoso (solo ante la primera
 * consulta), token en memoria y una sola solicitud de login a la vez. Si el
 * login falla por credenciales, no se reintenta en este proceso para no
 * insistir contra la cuenta.
 */
export class LoginTokenProvider implements TokenProvider {
  readonly #http: HttpClient;
  readonly #email: string;
  readonly #password: string;
  #token: string | undefined;
  #pending: Promise<string> | undefined;
  #fatal: LoggroError | undefined;

  constructor(http: HttpClient, email: string, password: string) {
    this.#http = http;
    this.#email = email;
    this.#password = password;
  }

  getToken(): Promise<string> {
    if (this.#fatal) return Promise.reject(this.#fatal);
    if (this.#token) return Promise.resolve(this.#token);
    this.#pending ??= this.#login().finally(() => {
      this.#pending = undefined;
    });
    return this.#pending;
  }

  invalidate(token: string): boolean {
    if (this.#token === token) this.#token = undefined;
    return this.#fatal === undefined;
  }

  async #login(): Promise<string> {
    let body: unknown;
    try {
      body = await this.#http.request(RESTOBAR_OPERATIONS.login, {
        body: { email: this.#email, password: this.#password },
      });
    } catch (err) {
      if (err instanceof HttpStatusError && (err.status === 400 || err.status === 401)) {
        const detail = err.apiMessage ? ` Restobar respondió: «${err.apiMessage}».` : '';
        this.#fatal = new LoggroError(
          'auth',
          `No fue posible iniciar sesión en Restobar con el usuario configurado.${detail} Corrige la configuración y reinicia el servidor.`,
        );
        throw this.#fatal;
      }
      if (err instanceof HttpStatusError) {
        throw new LoggroError(
          'unavailable',
          'El servicio de login de Restobar no respondió correctamente.',
        );
      }
      throw err;
    }
    const parsed = LoginResponse.safeParse(body);
    if (!parsed.success) {
      throw new LoggroError(
        'invalid_response',
        'La respuesta de login de Restobar no incluye el token.',
      );
    }
    this.#token = parsed.data.tokenCurrent;
    return this.#token;
  }
}
