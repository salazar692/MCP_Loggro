import { crc32, inflateRawSync } from 'node:zlib';

/**
 * Lector ZIP mínimo para pruebas: lee el directorio central, descomprime cada
 * entrada y verifica su CRC-32. Devuelve el contenido de texto por nombre.
 */
export function unzip(zip: Buffer): Map<string, string> {
  const end = zip.length - 22;
  if (zip.readUInt32LE(end) !== 0x06054b50) throw new Error('Falta el fin del directorio central');
  const count = zip.readUInt16LE(end + 10);
  let pos = zip.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(pos) !== 0x02014b50) throw new Error('Entrada central inválida');
    const method = zip.readUInt16LE(pos + 10);
    const crc = zip.readUInt32LE(pos + 16);
    const compressedSize = zip.readUInt32LE(pos + 20);
    const nameLength = zip.readUInt16LE(pos + 28);
    const extraLength = zip.readUInt16LE(pos + 30);
    const commentLength = zip.readUInt16LE(pos + 32);
    const localOffset = zip.readUInt32LE(pos + 42);
    const name = zip.toString('utf8', pos + 46, pos + 46 + nameLength);
    if (zip.readUInt32LE(localOffset) !== 0x04034b50)
      throw new Error(`Entrada local inválida: ${name}`);
    const start =
      localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const raw = zip.subarray(start, start + compressedSize);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    if (crc32(data) !== crc) throw new Error(`CRC incorrecto: ${name}`);
    files.set(name, data.toString('utf8'));
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
