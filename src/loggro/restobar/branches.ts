import { LoggroError } from '../../errors.ts';
import type { RestobarClient } from './client.ts';

/** Sucursal (negocio) de Restobar. Cada una tiene su propia credencial. */
export interface Branch {
  id: string;
  name: string;
}

/**
 * De dónde sale el cliente de Restobar de cada sucursal. Quien arma el servidor decide cómo se
 * obtiene el token de cada una (por ejemplo, la credencial que un servidor remoto guarda para
 * cada sucursal).
 */
export interface RestobarSource {
  /** `true` si hay varias sucursales: las herramientas aceptan `branch` y existe `restobar_list_branches`. */
  readonly multiBranch: boolean;
  listBranches(): Promise<Branch[]>;
  /** Cliente de la sucursal pedida (ID o nombre). Con una sola sucursal, `branch` se ignora. */
  client(branch?: string): Promise<RestobarClient>;
}

/** Una sola cuenta de Restobar: el caso de siempre. */
export function singleSource(client: RestobarClient): RestobarSource {
  return {
    multiBranch: false,
    listBranches: () => Promise.resolve([]),
    client: () => Promise.resolve(client),
  };
}

/**
 * Varias sucursales. `connect` crea el cliente de una sucursal la primera vez que se usa; el
 * resultado se reutiliza durante la vida del servidor.
 */
export class BranchSource implements RestobarSource {
  readonly multiBranch = true;
  readonly #branches: Branch[];
  readonly #connect: (branch: Branch) => RestobarClient | Promise<RestobarClient>;
  readonly #clients = new Map<string, Promise<RestobarClient>>();

  constructor(
    branches: Branch[],
    connect: (branch: Branch) => RestobarClient | Promise<RestobarClient>,
  ) {
    if (branches.length === 0) throw new LoggroError('config', 'No hay sucursales configuradas.');
    this.#branches = branches;
    this.#connect = connect;
  }

  listBranches(): Promise<Branch[]> {
    return Promise.resolve(this.#branches.map((b) => ({ ...b })));
  }

  client(branch?: string): Promise<RestobarClient> {
    const found = resolveBranch(this.#branches, branch);
    let client = this.#clients.get(found.id);
    if (!client) {
      client = Promise.resolve(this.#connect(found));
      // Un fallo al conectar no queda en caché: la siguiente consulta lo reintenta.
      client.catch(() => this.#clients.delete(found.id));
      this.#clients.set(found.id, client);
    }
    return client;
  }
}

/** «Sucursal del Viva», «viva» y «VIVA» deben encontrar la misma sucursal. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Busca la sucursal por ID exacto, por nombre exacto (sin tildes ni mayúsculas) o por un nombre que
 * aparezca en el texto pedido (o al revés). Si no hay una coincidencia única, el error lista las
 * sucursales para que el modelo pregunte o elija.
 */
export function resolveBranch(branches: Branch[], wanted: string | undefined): Branch {
  const names = branches.map((b) => b.name).join(', ');
  const query = normalize(wanted ?? '');
  if (!query) {
    if (branches.length === 1 && branches[0]) return branches[0];
    throw new LoggroError(
      'bad_request',
      `Hay varias sucursales (${names}). Indica en «branch» de cuál quieres la información.`,
    );
  }
  const byId = branches.find((b) => b.id === wanted?.trim());
  if (byId) return byId;
  const exact = branches.filter((b) => normalize(b.name) === query);
  if (exact.length === 1 && exact[0]) return exact[0];
  const partial = branches.filter((b) => {
    const name = normalize(b.name);
    return name.includes(query) || query.includes(name);
  });
  if (partial.length === 1 && partial[0]) return partial[0];
  throw new LoggroError(
    'bad_request',
    partial.length > 1
      ? `«${wanted}» coincide con varias sucursales (${partial.map((b) => b.name).join(', ')}). Sé más específico.`
      : `No existe la sucursal «${wanted}». Sucursales disponibles: ${names}.`,
  );
}
