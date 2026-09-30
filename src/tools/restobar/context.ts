import type { RestobarSource } from '../../loggro/restobar/branches.ts';
import type { Logger } from '../../logging.ts';

export interface RestobarToolContext {
  /** Cliente de Restobar por sucursal (una sola cuenta: `singleSource`). */
  restobar: RestobarSource;
  redactPersonalData: boolean;
  timeZone: string;
  /**
   * Carpeta local (absoluta) donde se guardan las exportaciones. `null` en un servidor remoto: el
   * archivo quedaría en el servidor y no en el computador del usuario, así que no se ofrece exportar.
   */
  exportDir: string | null;
  logger: Logger;
}
