import type { RestobarClient } from '../../loggro/restobar/client.ts';
import type { Logger } from '../../logging.ts';

export interface RestobarToolContext {
  /** Cliente de la cuenta de Restobar: una credencial, una cuenta. */
  restobar: RestobarClient;
  redactPersonalData: boolean;
  timeZone: string;
  /**
   * Carpeta local (absoluta) donde se guardan las exportaciones. `null` en un servidor remoto: el
   * archivo quedaría en el servidor y no en el computador del usuario, así que no se ofrece exportar.
   */
  exportDir: string | null;
  logger: Logger;
}
