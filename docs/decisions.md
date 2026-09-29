# Registro de decisiones técnicas

Formato breve tipo ADR. **Estado:** _Aceptada_ (base del repositorio actual) o _Propuesta_ (pendiente de
confirmación del propietario; ver [`open-questions.md`](./open-questions.md)).

---

## ADR-001 · Restobar como producto piloto

- **Estado:** Aceptada (2026-09-29). Ver también ADR-013.
- **Contexto:** Loggro expone siete productos con autenticaciones distintas
  ([`loggro-api/README.md`](./loggro-api/README.md) §1). El propietario solo tiene credenciales de Restobar.
- **Decisión:** la fase 1 cubre solo Restobar (REST/JSON, `https://api.pirpos.com`). La estructura del
  código separa los productos desde el inicio (`src/loggro/<producto>/`).
- **Consecuencias:** se puede validar contra la API real desde el primer día. PYMES, Nómina y los demás
  productos requieren su propio módulo de autenticación y no bloquean la fase 1.

## ADR-002 · Solo lectura mediante allowlist explícita

- **Estado:** Aceptada
- **Contexto:** en Loggro el método HTTP no indica si una operación es de lectura: hay GET que envían
  correos o generan pagos (Nómina) y consultas por POST (SOAP, PYMES).
- **Decisión:** cada operación permitida se declara una por una (método, ruta, página oficial). No existe un
  método genérico de solicitud. El transporte rechaza lo que no esté en la lista. Una prueba de contrato
  la compara con el inventario oficial.
- **Consecuencias:** añadir una herramienta requiere un cambio explícito y revisable. Es imposible
  «descubrir» endpoints en tiempo de ejecución, y eso es intencional.

## ADR-003 · TypeScript sobre Node.js ≥ 22.18, módulos ESM

- **Estado:** Aceptada
- **Contexto:** el SDK oficial de MCP de referencia está en TypeScript. Node 20 dejó de tener soporte en
  abril de 2026; hoy las líneas LTS mantenidas son 22 (mantenimiento) y 24 (activa).
- **Decisión:** TypeScript estricto, ESM (`"type": "module"`), `engines.node >= 22.18.0` y CI en Node 22 y 24.
  22.18 es la primera 22.x que ejecuta TypeScript de forma nativa (usado por `scripts/`) y cumple los
  requisitos de ESLint 10 y Vitest 5.
- **Consecuencias:** `fetch`, `AbortSignal.timeout` y `--env-file` están disponibles sin dependencias.
  El paquete publicado se compila a JavaScript (`dist/`), porque Node no ejecuta TypeScript dentro de
  `node_modules`.

## ADR-004 · SDK oficial `@modelcontextprotocol/sdk`

- **Estado:** Aceptada. Se instalará junto con la primera herramienta, no antes.
- **Contexto:** implementar el protocolo a mano (JSON-RPC, negociación, esquemas) es innecesario y
  arriesgado. Versión verificada: 1.31.0 (npm, 2026-09-29), `peerDependencies: zod ^3.25 || ^4.0`.
- **Decisión:** usar `McpServer` y `StdioServerTransport` del SDK oficial, y `InMemoryTransport` en pruebas.
- **Consecuencias:** se sigue la evolución de la especificación MCP con actualizaciones del SDK.

## ADR-005 · Zod para validación

- **Estado:** Aceptada. Se instalará con la primera herramienta.
- **Contexto:** el SDK define los esquemas de entrada y salida de las herramientas con Zod; además hay que
  validar la configuración y las respuestas de Loggro, que no siempre respetan su propio esquema.
- **Decisión:** una sola librería de validación (Zod 4, compatible con el SDK) para herramientas,
  configuración y respuestas.
- **Consecuencias:** un solo modelo mental. Tipos TypeScript derivados de los esquemas.

## ADR-006 · `fetch` nativo; sin cliente HTTP externo

- **Estado:** Aceptada
- **Contexto:** Node 22 trae `fetch` (undici), timeouts con `AbortSignal` y respeto de proxy con
  `NODE_USE_ENV_PROXY=1`.
- **Decisión:** no usar axios, got ni ky. El transporte recibe `fetch` por inyección, así que las pruebas
  usan un `fetch` falso sin nock ni msw.
- **Consecuencias:** cero dependencias de red. Reintentos y límites se implementan en un módulo pequeño y probado.

## ADR-007 · Transporte stdio en la fase 1

- **Estado:** Aceptada (2026-09-29: la fase 1 es un MCP funcional que cualquier persona instala en su equipo)
- **Contexto:** con stdio, el servidor corre en la máquina del usuario con sus propias credenciales. Un
  servidor HTTP remoto requiere autorización OAuth según la especificación MCP, aislamiento de
  credenciales por usuario y operación de infraestructura.
- **Decisión:** solo stdio. El transporte HTTP remoto se evaluará después, con su propio diseño de seguridad.
- **Consecuencias:** instalación por usuario (`npx` o clonando el repositorio). No hay servidor compartido.

## ADR-008 · Herramientas de desarrollo

- **Estado:** Aceptada
- **Decisión y justificación de cada dependencia de desarrollo:**

| Dependencia | Para qué | Por qué esta y no otra |
| --- | --- | --- |
| `typescript` **6.0.x** | Compilación y verificación de tipos | La 7.0 ya existe, pero `typescript-eslint` 8.x admite `typescript < 6.1`. Se actualizará cuando sea compatible. |
| `@types/node` **22.x** | Tipos de Node | Coincide con la versión mínima soportada, para no usar APIs inexistentes en Node 22. |
| `eslint` + `@eslint/js` + `typescript-eslint` | Análisis estático con tipos (p. ej. promesas no esperadas) | Estándar del ecosistema; configuración plana sin plugins extra. |
| `prettier` | Formato automático de código, JSON y YAML | Evita discusiones de estilo en PR. Markdown queda excluido: Prettier alinea las tablas anchas y cada cambio de celda reescribiría la tabla entera. |
| `vitest` | Pruebas | Soporta TypeScript y ESM sin configuración de transpilación. |

- **Descartadas por ahora:** `eslint-config-prettier` (las configuraciones usadas no incluyen reglas de
  formato), `husky`/`lint-staged` (la CI hace cumplir las reglas; menos fricción para contribuir),
  `dotenv` (Node ya trae `--env-file`), `nock`/`msw` (basta con inyectar `fetch`), `tsx`/`ts-node`
  (Node ejecuta TypeScript de forma nativa), herramientas de cobertura (se añadirán cuando haya código que medir).

## ADR-009 · npm como gestor y canal de distribución

- **Estado:** Aceptada. El nombre del paquete sigue como propuesta.
- **Contexto:** el proyecto servirá en producción a cualquier persona que quiera instalarlo.
- **Decisión:** npm (incluido con Node), `package-lock.json` versionado y `npm ci` en CI. Distribución por
  npm para instalar con `npx`, versionado SemVer desde `0.1.0`, `CHANGELOG.md` y releases en GitHub desde
  la primera versión funcional. Hasta entonces, `"private": true` evita publicar por accidente. Nombre
  propuesto: `mcp-loggro` (libre en npm el 2026-09-29).

## ADR-010 · Inventario de la API generado y versionado

- **Estado:** Aceptada
- **Contexto:** la regla del proyecto es «no inventar» y la documentación de Loggro cambia (hay páginas
  actualizadas en septiembre de 2026).
- **Decisión:** `scripts/sync-loggro-docs.ts` (sin dependencias) regenera `docs/loggro-api/inventory/` desde
  el índice oficial. El resultado se versiona para que los cambios de Loggro aparezcan como diff en Git.
- **Consecuencias:** cualquier persona puede verificar de dónde sale cada endpoint. Las reglas de
  clasificación viven en código revisable (`scripts/lib/loggro-docs.ts`).

## ADR-011 · Datos personales incluidos, con redacción opcional

- **Estado:** Aceptada (2026-09-29, decisión del propietario; reemplaza la propuesta de excluirlos)
- **Contexto:** casos de uso reales como «dame el listado de mis clientes en Excel» necesitan documento,
  correo y teléfono.
- **Decisión:** las herramientas devuelven los datos de contacto e identificación de clientes y
  proveedores. Quien instale el servidor puede ocultarlos con `LOGGRO_REDACT_PERSONAL_DATA=true`. Los
  **secretos** (`password` de mesas, tokens, `lastTokenDevice`) se eliminan siempre, sin excepción.
- **Consecuencias:** la responsabilidad de enviar datos personales al proveedor del modelo recae en quien
  instala el servidor; el README lo advierte (ver [`security.md`](./security.md) §4).

## ADR-012 · Idioma

- **Estado:** Aceptada por defecto (sin objeción del propietario)
- **Decisión:** documentación en español, con resumen en inglés en el README. Nombres de herramientas e
  identificadores de código en inglés (estables, ASCII). Descripciones de herramientas y mensajes de error
  en español.

## ADR-013 · Solo se implementa lo que se puede probar: Restobar

- **Estado:** Aceptada (2026-09-29)
- **Contexto:** el propietario solo tiene acceso a Restobar, en un negocio real en producción. Los demás
  productos no se pueden verificar.
- **Decisión:** la fase 1 implementa y prueba contra la API real **solo Restobar**. Los demás productos
  quedan documentados en el inventario, sin código, hasta que alguien con credenciales pueda probarlos.
  No se publican herramientas «teóricas» sin verificar.
- **Consecuencias:** el README solo anuncia lo verificado. Contribuciones de otros productos exigen
  evidencia de prueba real (sin datos reales en el PR).

## ADR-014 · Credenciales de Restobar: token o usuario y contraseña

- **Estado:** Aceptada e implementada (`src/config.ts`, `src/loggro/restobar/auth.ts`). El modo token es el recomendado.
- **Contexto:** Restobar solo documenta `POST /login` con correo y contraseña. El propietario usará su
  propio usuario de producción, que probablemente tenga permisos de escritura, y ya tiene automatizaciones
  con la API.
- **Decisión:** aceptar **uno** de dos modos:
  1. `LOGGRO_RESTOBAR_TOKEN`: un token ya obtenido. El servidor no guarda contraseña ni hace login; si el
     token vence, responde con un error que explica cómo renovarlo.
  2. `LOGGRO_RESTOBAR_EMAIL` + `LOGGRO_RESTOBAR_PASSWORD`: login automático, token en memoria y un único
     re-login ante `401`.
- **Consecuencias:** el modo token evita dejar la contraseña en la configuración del cliente MCP. El modo
  usuario y clave es más cómodo, pero su riesgo depende de si un login nuevo invalida otras sesiones
  (pregunta B2), lo que podría afectar al POS y a las automatizaciones existentes.

## ADR-015 · Exportación a archivo local (Excel)

- **Estado:** Aceptada e implementada (2026-09-29): `restobar_export_clients` y `restobar_clients_summary`
- **Contexto:** caso de uso del propietario: «un listado de mis clientes en Excel sin entrar a Loggro».
  Pasar miles de registros por el modelo es lento, costoso, se trunca y expone todos los datos al proveedor
  del modelo.
- **Decisión:** herramientas de exportación (empezando por `restobar_export_clients`) que descargan todas
  las páginas, escriben un archivo `.xlsx` (o `.csv`) en una carpeta local y devuelven al modelo solo la
  ruta, el número de filas y las columnas, **no los datos**.
- **Reglas:** nombre de archivo generado por el servidor (nunca por el modelo), carpeta configurable
  (`LOGGRO_EXPORT_DIR`), sin sobrescribir archivos existentes, permisos solo para el usuario y
  neutralización de fórmulas (celdas que empiezan con `=`, `+`, `-` o `@`). Como escribe en el disco del
  usuario, la herramienta declara `readOnlyHint: false` y `destructiveHint: false`; en Loggro sigue siendo
  solo lectura.
- **Decisión del propietario (2026-09-29):** con miles de clientes el MCP debe decir que no puede
  traerlos al chat y ofrecer exportarlos a Excel o resumirlos.
- **Por qué en el servidor y no en el asistente:** un MCP es el puente, pero el asistente solo puede
  trabajar con lo que pasa por la conversación. Para armar un Excel o contar miles de clientes tendría
  que recibirlos todos (lento, costoso, se trunca y expone los datos al proveedor del modelo). El servidor
  ya tiene los datos a mano: los agrega o los escribe en disco y al modelo solo le entrega el resultado.
- **Implementación:**
  - `.xlsx` real con un escritor propio (`src/export/xlsx.ts`, unas 200 líneas sobre `node:zlib`:
    `deflateRawSync` y `crc32`) en lugar de una dependencia: las librerías de Excel traen decenas de
    dependencias transitivas para una hoja de texto. Se descartó CSV: en Excel con configuración regional
    de Colombia el separador de listas es `;`, y además convierte teléfonos y documentos en números
    (pierde ceros a la izquierda). Validado con `openpyxl` (30 000 filas, caracteres especiales).
  - Los textos van como `inlineStr`: Excel nunca los evalúa como fórmula, así que no hace falta alterar
    celdas que empiezan con `=`, `+`, `-` o `@`.
  - Descarga en lotes de 500 (la API admite hasta 10 000; 500 deja margen al límite de 5 MB por
    respuesta), en secuencia, con máximo 50 000 clientes (100 solicitudes). Deduplica por `_id` e informa
    `complete: false` si Restobar entrega menos de lo que dice su `count`.
  - Carpeta: `LOGGRO_EXPORT_DIR` o, por omisión, `~/Downloads/MCP-Loggro`. Con
    `LOGGRO_REDACT_PERSONAL_DATA=true` se omiten las columnas personales.
  - Los listados avisan (`pagination.notice`) cuando el total supera 200 y las instrucciones del servidor
    piden no recorrer decenas de páginas.

## ADR-016 · Varias sucursales, cada una con su token

- **Estado:** Propuesta
- **Contexto:** en Restobar cada sucursal tiene su propio token (respuesta del propietario, 2026-09-29).
- **Hoy:** se configura un servidor por sucursal en el cliente MCP (`loggro-centro`, `loggro-norte`, …).
  No requiere código, pero una pregunta como «ventas de todas las sucursales» obliga al modelo a llamar
  a cada servidor por separado.
- **Propuesta:** un solo servidor con varias sucursales con nombre (p. ej. `LOGGRO_RESTOBAR_BRANCHES`),
  un parámetro opcional `branch` en cada herramienta y una herramienta para listar las sucursales
  configuradas.

## ADR-017 · Dependencias de ejecución

- **Estado:** Aceptada (2026-09-29)
- **Decisión:** `@modelcontextprotocol/sdk` 1.31 y `zod` 4 (ADR-004 y ADR-005). Ninguna otra.
  `npm audit`: 0 vulnerabilidades al instalarlas.
