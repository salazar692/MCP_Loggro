# Integración remota: MCP_Loggro dentro de tu propio servidor

MCP_Loggro se usa normalmente en local (stdio): cada persona lo instala en su equipo con su credencial.
Este documento es para quien ya **guarda las credenciales de Restobar de sus usuarios en un servidor**
(una plataforma con varios negocios o varias sucursales) y quiere que esos usuarios conecten Claude
**sin configurar nada ni generar tokens nuevos**: el servidor usa la credencial que ya tiene.

```text
Claude ──(MCP por HTTP + OAuth)──▶ tu endpoint MCP ──▶ MCP_Loggro (librería) ──▶ api.pirpos.com
                                        │                      ▲
                                        └── identifica al usuario y le entrega
                                            el token de cada sucursal (TokenProvider)
```

MCP_Loggro pone las herramientas, los esquemas y el mapeo de datos; tu servidor pone la autenticación
del usuario, la búsqueda de la credencial y el transporte HTTP.

## 1. Qué importa tu servidor

Punto de entrada: [`src/remote.ts`](../src/remote.ts).

| Export | Uso |
| --- | --- |
| `createServer(ctx)` | Crea el `McpServer` con todas las herramientas. |
| `RestobarClient`, `HttpClient`, `RESTOBAR_ALLOWLIST` | Cliente de solo lectura de una cuenta (sucursal) de Restobar. |
| `TokenProvider` | Contrato que implementas para entregar el token (ver §3). |
| `singleSource(client)` | Una sola cuenta. |
| `BranchSource(branches, connect)` | Varias sucursales, cada una con su credencial (ver §4). |
| `resolveBranch`, `silentLogger`, `createLogger`, `VERSION` | Utilidades. |

**Node.js:** `npm install github:salazar692/MCP_Loggro_Restobar#<commit>` e
`import { createServer, … } from 'mcp-loggro/remote'`.

**Deno (p. ej. Supabase Edge Functions):** importa el código fuente fijado a un commit (inmutable) y
declara las dos dependencias en el `deno.json` de la función:

```json
{
  "imports": {
    "mcp-loggro/": "https://raw.githubusercontent.com/salazar692/MCP_Loggro_Restobar/<COMMIT>/src/",
    "zod": "npm:zod@^4.6.5",
    "@modelcontextprotocol/sdk/": "npm:/@modelcontextprotocol/sdk@^1.31.0/"
  }
}
```

```ts
import { createServer, BranchSource, … } from "mcp-loggro/remote.ts";
```

Verificado con Deno 2: `initialize`, `tools/list` y `tools/call` por HTTP con dos sucursales. Actualiza
`<COMMIT>` a propósito cuando quieras una versión nueva; nunca apuntes a una rama.

## 2. Endpoint MCP (Streamable HTTP, sin sesión)

Crea un servidor **por petición** (es barato) con el usuario ya autenticado, y responde con el
transporte web estándar del SDK:

```ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer, silentLogger } from "mcp-loggro/remote.ts";

async function mcp(req: Request, source: RestobarSource): Promise<Response> {
  const server = createServer({
    restobar: source,
    redactPersonalData: false,
    timeZone: "America/Bogota",
    exportDir: null, // remoto: sin exportación a archivo (quedaría en tu servidor, no en el equipo del usuario)
    logger: silentLogger,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // sin estado: cada POST es independiente
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}
```

Con `exportDir: null` no se registra `restobar_export_clients` y las instrucciones del servidor le
dicen al modelo que use `restobar_clients_summary`.

## 3. `TokenProvider`: de dónde sale el token

```ts
interface TokenProvider {
  getToken(): Promise<string>;           // token vigente (sin "Bearer ")
  invalidate(token: string): boolean;    // Restobar lo rechazó (401): ¿puedes conseguir otro?
}
```

- `getToken()` debe leer la credencial que tu servidor **ya guarda** para esa cuenta (caché en memoria,
  base de datos o login con la contraseña cifrada, en ese orden). No generes tokens nuevos si ya hay uno.
- Si Restobar responde 401, el cliente llama `invalidate(token)`. Devuelve `true` si puedes renovarlo:
  el siguiente `getToken()` debe forzar la renovación. El cliente reintenta **una sola vez**.
- El token nunca sale de tu servidor: no lo devuelvas en respuestas, no lo registres en logs.

## 4. Sucursales

Cada sucursal de Restobar es un negocio con su propia credencial. Con `BranchSource`:

```ts
const source = new BranchSource(
  [{ id: "<id interno>", name: "Viva" }, { id: "<id interno>", name: "Meridiem" }],
  (branch) => new RestobarClient(
    new HttpClient({ baseUrl: urlDeLaSucursal, allowlist: RESTOBAR_ALLOWLIST }),
    tokenProviderDe(branch.id),
  ),
);
```

- Con más de una sucursal, **todas las herramientas aceptan `branch`** y aparece
  `restobar_list_branches`. `branch` admite el id o el nombre, sin tildes ni mayúsculas, e incluso una
  frase («la sucursal del Viva»). Si falta o es ambiguo, la herramienta responde con la lista de
  sucursales para que el modelo pregunte.
- Con una sola sucursal usa `singleSource(client)`: no aparece `branch`.
- **Autorización:** la lista que le pasas a `BranchSource` ES el control de acceso. Incluye solo las
  sucursales que el usuario autenticado puede ver **y** que tienen credencial de Restobar activa. El
  parámetro `branch` solo elige dentro de esa lista; nunca permite salir de ella.
- `connect` se llama una vez por sucursal y por servidor (petición); los fallos no quedan en caché.

## 5. Autenticación de Claude (OAuth 2.1)

Claude se conecta a servidores MCP remotos como **conector personalizado** y se autentica con OAuth
según la especificación de autorización de MCP:

1. Sin `Authorization: Bearer …` válido, el endpoint responde `401` con
   `WWW-Authenticate: Bearer resource_metadata="<url de metadatos>"`.
2. Esa URL devuelve los metadatos del recurso protegido (RFC 9728):

   ```json
   {
     "resource": "https://tu-servidor/mcp",
     "authorization_servers": ["https://tu-servidor-de-autorizacion"],
     "bearer_methods_supported": ["header"]
   }
   ```

3. El servidor de autorización publica sus metadatos (RFC 8414), admite **registro dinámico de
   clientes** y PKCE, y muestra al usuario una pantalla de consentimiento. Supabase Auth, por ejemplo,
   lo ofrece como «OAuth 2.1 Server» (Authentication → OAuth Server), con los metadatos en
   `https://<proyecto>.supabase.co/.well-known/oauth-authorization-server/auth/v1`.
4. Claude recibe un access token (JWT) y lo envía en cada petición. Tu endpoint lo valida, identifica al
   usuario y arma el `RestobarSource` con sus sucursales.

En Claude: **Configuración → Conectores → Agregar conector personalizado**, con la URL del endpoint.
La URL de retorno de Claude que debe aceptar el servidor de autorización es
`https://claude.ai/api/mcp/auth_callback`.

## 6. Lista de verificación

- [ ] El endpoint valida el JWT en **cada** petición y deduce el usuario del token, nunca del cuerpo.
- [ ] `BranchSource` solo recibe sucursales visibles para ese usuario y con credencial activa.
- [ ] El token de Restobar no aparece en respuestas, logs ni errores.
- [ ] `exportDir: null`.
- [ ] La versión de MCP_Loggro está fijada a un commit.
- [ ] Probado: `initialize`, `tools/list` (con `restobar_list_branches` si hay varias sucursales) y una
      consulta por sucursal que use su propio token.
- [ ] El usuario sabe que lo que devuelven las herramientas llega al proveedor del modelo, incluidos
      datos personales de clientes (ver [`security.md`](./security.md)).
