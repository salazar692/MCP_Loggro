# Arquitectura de MCP_Loggro

> **Estado:** propuesta inicial. Todavía no hay herramientas implementadas. Cambiar esta
> arquitectura requiere actualizar [`decisions.md`](./decisions.md).

## 1. Objetivo y alcance

MCP_Loggro es un servidor [Model Context Protocol](https://modelcontextprotocol.io) que permite a
asistentes de IA **consultar** datos de Loggro de forma segura y estructurada.

- **Fase 1 (actual):** solo lectura, un producto (**Restobar**), ejecución local (transporte stdio).
  Además, las mismas herramientas se pueden montar en un servidor remoto propio como librería
  (`src/remote.ts`, ADR-018; guía en [`remote-integration.md`](./remote-integration.md)).
- **Fuera de alcance:** crear, modificar, eliminar o anular registros; operaciones financieras;
  cualquier acción irreversible; guardar o administrar credenciales de terceros (eso lo hace la
  plataforma que integra la librería).

## 2. Vista general

```text
┌──────────────────────────┐
│ Cliente MCP              │  Claude Desktop, Claude Code, otros clientes compatibles
└────────────┬─────────────┘
             │ JSON-RPC sobre stdio (stdout reservado al protocolo)
┌────────────▼─────────────┐
│ Capa MCP  (src/server)   │  Registro de herramientas, validación de entrada (Zod),
│                          │  anotaciones readOnly, mapeo de errores a resultados MCP
└────────────┬─────────────┘
             │ llama a funciones de dominio (sin HTTP)
┌────────────▼─────────────┐
│ Herramientas (src/tools) │  Una herramienta = una intención de consulta.
│                          │  Normaliza paginación y fechas; sanea y recorta la salida
└────────────┬─────────────┘
             │ interfaz tipada por producto (p. ej. RestobarReadClient)
┌────────────▼─────────────┐
│ Clientes Loggro          │  Un módulo por producto: allowlist de operaciones,
│ (src/loggro/<producto>)  │  autenticación propia, tipos de respuesta, errores propios
└────────────┬─────────────┘
             │ solicitudes ya validadas contra la allowlist
┌────────────▼─────────────┐
│ Transporte HTTP          │  fetch nativo, timeouts, reintentos acotados, límite de
│ (src/http)               │  tamaño, redacción de secretos en logs
└────────────┬─────────────┘
             ▼
        API de Loggro (Restobar: https://api.pirpos.com)
```

Transversales: `config` (variables de entorno validadas), `logging` (solo a **stderr**),
`errors` (jerarquía común), `sanitize` (filtrado de campos sensibles).

## 3. Responsabilidades y reglas de dependencia

| Capa | Hace | No hace |
| --- | --- | --- |
| **Capa MCP** | Crea el `McpServer`, registra herramientas, conecta el transporte y convierte errores tipados en resultados `isError`. | No conoce URL, tokens ni formatos de Loggro. |
| **Herramientas** | Definen nombre, descripción, esquema de entrada y salida; llaman al cliente de dominio; dan forma, sanean y paginan la salida. | No hacen `fetch`. No reciben credenciales como argumentos. |
| **Clientes Loggro** | Exponen **un método por operación permitida** (p. ej. `listInvoices`), construyen la consulta y parsean la respuesta. | No exponen un método genérico `request(method, path)`. |
| **Autenticación** | Login, token en memoria y un único re-login ante `401`. | No persiste tokens en disco ni los registra en logs. |
| **Transporte HTTP** | Timeouts, reintentos en `429`/`503`/errores de red, límite de bytes de respuesta y verificación final contra la allowlist. | No decide qué operaciones existen. |

Las dependencias van **solo hacia abajo**. Las herramientas dependen de interfaces, no de
implementaciones, así que en pruebas se inyecta un cliente falso o un `fetch` falso.

## 4. Flujo de una consulta

1. El cliente MCP invoca `restobar_list_invoices` con `{ dateFrom, dateTo, status, page }`.
2. El SDK valida los argumentos con el esquema Zod. Si no son válidos, el modelo recibe el error y puede corregir.
3. La herramienta convierte fechas y paginación al formato de Restobar (`page` desde 0, `limit`, `pagination=true`).
4. El cliente Restobar obtiene un token (login perezoso; re-login una sola vez ante `401`).
5. El transporte HTTP comprueba que `GET /invoices` está en la allowlist y ejecuta la solicitud con timeout.
6. La respuesta se parsea y se reduce a los campos declarados en el `outputSchema` de la herramienta.
   Los campos sensibles se eliminan o enmascaran.
7. La herramienta devuelve `structuredContent` (JSON validado) más un resumen en texto, con metadatos de
   paginación (`page`, `pageSize`, `total`, `hasMore`) y aviso si hubo recorte.

## 5. Autenticación y configuración

- Las credenciales **solo** llegan por variables de entorno (ver [`../.env.example`](../.env.example)).
  Nunca por argumentos de herramienta ni por archivos del repositorio.
- Restobar admite dos modos (ADR-014):
  - **Token** (`LOGGRO_RESTOBAR_TOKEN`): se usa tal cual; si vence, se devuelve un error que explica cómo
    renovarlo. No se guarda ninguna contraseña.
  - **Usuario y clave**: `POST /login` → `tokenCurrent`. El token vive **solo en memoria**, el login es
    perezoso (solo cuando llega la primera consulta) y se repite una única vez ante `401`.
  La duración real del token y el efecto de un login nuevo sobre otras sesiones no están documentados
  (B1 y B2 en [`open-questions.md`](./open-questions.md)).
- La configuración se valida al arrancar con Zod. Si falta algo, el proceso termina con un mensaje
  claro en stderr que nunca imprime el valor de los secretos.
- Cada producto futuro tendrá su propio prefijo (`LOGGRO_RESTOBAR_*`, `LOGGRO_PYMES_*`, …) y se
  activará solo si su configuración está presente.

## 6. Solo lectura: defensa en capas

1. **Allowlist por operación:** cada operación permitida se declara con método, plantilla de ruta y
   página oficial (`docSlug`). Una prueba verifica que figure en
   [`loggro-api/inventory/`](./loggro-api/inventory/README.md) con clase `lectura`.
2. **Sin puerta genérica:** ninguna capa expone «llamar a cualquier endpoint».
3. **Verificación en el transporte:** el cliente HTTP rechaza cualquier solicitud fuera de la
   allowlist. La única excepción es `POST /login` de autenticación.
4. **Anotaciones MCP:** todas las herramientas declaran `readOnlyHint: true`,
   `destructiveHint: false` y `openWorldHint: true`.
5. **Mínimo privilegio en Loggro:** se recomienda un usuario dedicado con el rol mínimo (ver
   [`security.md`](./security.md)). Es la única defensa real si hay un error en el código.

## 7. Errores

Errores tipados internos, mapeados a resultados MCP (`isError: true`) con mensajes accionables en
español y sin detalles internos:

| Situación | Origen típico | Mensaje hacia el modelo |
| --- | --- | --- |
| Configuración incompleta | arranque | El proceso no arranca y el error va a stderr. |
| Credenciales inválidas | `400` en `/login` | «No fue posible autenticarse en Restobar; revisa la configuración.» |
| Token vencido | `401` | Re-login transparente; si vuelve a fallar, error de autenticación. |
| Falta de permiso | `403` | «El usuario configurado no tiene permiso para esta consulta.» |
| Plan insuficiente | `402` | «Esta consulta requiere plan premium en Restobar.» |
| No encontrado | `404`, `null`, algunos `401`/`500` con mensaje | «No se encontró el registro solicitado.» |
| Límite de peticiones | `429` | Reintento con backoff; si persiste, «Loggro limitó las solicitudes; intenta más tarde.» |
| Error del servicio | `5xx`, timeout, red | «Loggro no respondió correctamente; intenta más tarde.» |

Restobar no usa los códigos HTTP de forma consistente (ver
[`loggro-api/README.md` §2.4](./loggro-api/README.md#24-errores-restobar)). El mapeo combina código y
mensaje, y se cubre con pruebas usando los ejemplos oficiales.

## 8. Logging

- **Todo log va a stderr.** En transporte stdio, stdout es el canal del protocolo y escribir ahí
  corrompe la sesión.
- Nivel configurable (`LOG_LEVEL`). Nunca se registran cabeceras `Authorization`, cuerpos de login,
  tokens ni respuestas completas de Loggro. Se registran método, plantilla de ruta, código, duración
  e identificador de solicitud.
- La redacción de secretos se aplica en un solo lugar (el logger) y tiene pruebas.

## 9. Estructura de carpetas

```text
src/
  index.ts                 # entrada del ejecutable: config → servidor → stdio
  remote.ts                # librería para servidores remotos (ADR-018)
  server.ts                # createServer(deps): registra herramientas
  config.ts                # esquema Zod de variables de entorno
  logging.ts               # logger a stderr con redacción
  errors.ts                # errores tipados y mapeo a resultados MCP
  http/
    client.ts              # fetch con timeout, reintentos, límites y allowlist
  loggro/
    restobar/
      operations.ts        # allowlist: id, método, ruta y página oficial
      auth.ts              # TokenProvider: token fijo o login con caché en memoria
      branches.ts          # sucursales: singleSource, BranchSource, resolveBranch (ADR-016)
      client.ts            # un método por operación permitida
      schemas.ts           # esquemas Zod de las respuestas (solo campos usados)
  export/
    xlsx.ts                # escritor .xlsx sin dependencias (ADR-015)
    save.ts                # archivo nuevo en la carpeta local configurada, sin sobrescribir
  tools/
    shared.ts              # paginación, fechas y formato de salida comunes
    restobar/              # herramientas por recurso; branch.ts añade `branch` y list_branches
scripts/
  sync-loggro-docs.ts      # regenera docs/loggro-api/inventory
  smoke-restobar.ts        # prueba manual contra Restobar real, con tope de solicitudes
tests/
  unit/                    # sin red: fetch y clientes falsos
  contract/                # allowlist frente al inventario oficial
  e2e/                     # servidor MCP completo con fetch falso (incluye sucursales)
```

## 10. Estrategia de pruebas

| Nivel | Qué verifica | Red | En CI |
| --- | --- | --- | --- |
| Unitarias | Mapeo de parámetros, paginación, fechas, saneamiento, mapeo de errores, redacción de logs. | No (fetch inyectado) | Sí |
| Contrato | Toda operación de la allowlist existe en el inventario oficial y es de lectura. | No | Sí |
| MCP extremo a extremo | Cliente y servidor del SDK conectados en memoria: listado de herramientas, esquemas y llamadas. | No | Sí |
| Integración | Llamadas reales a Restobar (negocio en producción): solo herramientas de lectura; verifican la forma de las respuestas y **no imprimen datos**. | Sí | **No** (manual, en el equipo del propietario, opt-in) |
| Manual | [MCP Inspector](https://github.com/modelcontextprotocol/inspector) y un cliente real. | Sí | No |

Los fixtures se construyen a partir de los **ejemplos oficiales** del OpenAPI y usan solo datos
sintéticos. Nunca se versionan respuestas reales.

## 11. Limitaciones conocidas

- Un solo producto (Restobar) en la fase 1: es el único que se puede probar contra la API real (ADR-013).
  Cada producto adicional exige otro módulo de autenticación y pruebas reales antes de publicarse.
- Duración del token, sesión única, límites de peticiones y zona horaria de Restobar **no están
  documentados**; se validarán en pruebas reales antes de diseñar alrededor de ellos.
- Las cuentas trial o gratuitas limitan el historial visible (24 h o 30 días); el MCP no puede
  sortear esas restricciones y debe explicarlas.
- Transporte remoto (HTTP) fuera de alcance: requiere autorización OAuth según la especificación
  MCP y aislamiento de credenciales por usuario.
