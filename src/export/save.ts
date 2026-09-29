import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { LoggroError } from '../errors.ts';

const MAX_NAME_ATTEMPTS = 20;

/**
 * Guarda `data` como archivo NUEVO en `dir` y devuelve su ruta absoluta.
 * El nombre lo decide el servidor (nunca el modelo); si ya existe, agrega un
 * sufijo en lugar de sobrescribir. Carpeta y archivo quedan solo para el usuario.
 */
export async function saveNewFile(
  dir: string,
  baseName: string,
  extension: string,
  data: Buffer,
): Promise<string> {
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    for (let n = 1; n <= MAX_NAME_ATTEMPTS; n++) {
      const file = path.join(dir, `${baseName}${n === 1 ? '' : `-${n}`}.${extension}`);
      try {
        await writeFile(file, data, { flag: 'wx', mode: 0o600 });
        return file;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      }
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? 'desconocido';
    throw new LoggroError(
      'export',
      `No se pudo guardar el archivo en «${dir}» (${code}). Revisa que la carpeta exista o se pueda crear ` +
        'y que haya permiso de escritura, o configura otra con LOGGRO_EXPORT_DIR.',
      { cause: err },
    );
  }
  throw new LoggroError('export', `Ya existen demasiados archivos con el nombre «${baseName}».`);
}
