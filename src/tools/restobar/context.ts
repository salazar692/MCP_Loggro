import type { RestobarClient } from '../../loggro/restobar/client.ts';
import type { Logger } from '../../logging.ts';

export interface RestobarToolContext {
  restobar: RestobarClient;
  redactPersonalData: boolean;
  timeZone: string;
  logger: Logger;
}
