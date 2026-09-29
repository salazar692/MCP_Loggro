/** Categorías de error que el servidor sabe explicar al modelo. */
export type LoggroErrorKind =
  | 'config'
  | 'auth'
  | 'forbidden'
  | 'premium'
  | 'plan_limit'
  | 'not_found'
  | 'rate_limited'
  | 'unavailable'
  | 'bad_request'
  | 'invalid_response'
  | 'blocked';

/**
 * Error tipado de MCP_Loggro. `message` es seguro para mostrar: nunca contiene
 * tokens, cabeceras ni cuerpos completos de Loggro.
 */
export class LoggroError extends Error {
  readonly kind: LoggroErrorKind;

  constructor(kind: LoggroErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LoggroError';
    this.kind = kind;
  }
}

const GENERIC_MESSAGES: Record<LoggroErrorKind, string> = {
  config: 'La configuración de MCP_Loggro es inválida.',
  auth: 'No fue posible autenticarse en Restobar. Revisa el token o las credenciales configuradas.',
  forbidden: 'El usuario configurado en Restobar no tiene permiso para esta consulta.',
  premium: 'Esta consulta requiere un plan premium en Restobar.',
  plan_limit: 'El plan del negocio en Restobar no permite consultar ese rango de fechas.',
  not_found: 'No se encontró el registro solicitado en Restobar.',
  rate_limited: 'Restobar limitó las solicitudes. Intenta de nuevo en unos minutos.',
  unavailable: 'Restobar no respondió correctamente. Intenta de nuevo más tarde.',
  bad_request: 'Restobar rechazó los parámetros de la consulta.',
  invalid_response: 'Restobar devolvió una respuesta con un formato inesperado.',
  blocked: 'Operación bloqueada: MCP_Loggro solo permite consultas de lectura.',
};

/** Mensaje para el modelo o el usuario final, sin detalles internos. */
export function userMessage(err: unknown): string {
  if (err instanceof LoggroError) {
    return err.message || GENERIC_MESSAGES[err.kind];
  }
  return 'Ocurrió un error inesperado en MCP_Loggro.';
}

export function genericMessage(kind: LoggroErrorKind): string {
  return GENERIC_MESSAGES[kind];
}
