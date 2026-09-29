# Registro de decisiones técnicas

Formato breve tipo ADR. **Estado:** _Aceptada_ (base del repositorio actual) o _Propuesta_ (pendiente de
confirmación del propietario; ver [`open-questions.md`](./open-questions.md)).

---

## ADR-001 · Restobar como producto piloto

- **Estado:** Aceptada (2026-09-29)
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

- **Estado:** Propuesta
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

## ADR-009 · npm como gestor de paquetes; paquete privado hasta definir la publicación

- **Estado:** Propuesta
- **Decisión:** npm (incluido con Node, sin herramientas adicionales para quien contribuye),
  `package-lock.json` versionado y `npm ci` en CI. `"private": true` evita publicar por accidente hasta
  decidir nombre y estrategia de publicación (el nombre `mcp-loggro` estaba libre en npm el 2026-09-29).

## ADR-010 · Inventario de la API generado y versionado

- **Estado:** Aceptada
- **Contexto:** la regla del proyecto es «no inventar» y la documentación de Loggro cambia (hay páginas
  actualizadas en septiembre de 2026).
- **Decisión:** `scripts/sync-loggro-docs.ts` (sin dependencias) regenera `docs/loggro-api/inventory/` desde
  el índice oficial. El resultado se versiona para que los cambios de Loggro aparezcan como diff en Git.
- **Consecuencias:** cualquier persona puede verificar de dónde sale cada endpoint. Las reglas de
  clasificación viven en código revisable (`scripts/lib/loggro-docs.ts`).

## ADR-011 · Datos personales excluidos por defecto

- **Estado:** Propuesta
- **Decisión:** las herramientas omiten documento, correo, teléfono, dirección y fecha de nacimiento de
  clientes y proveedores, salvo que el propietario de la instalación lo active de forma explícita
  (mecanismo por definir).

## ADR-012 · Idioma

- **Estado:** Propuesta
- **Decisión:** documentación en español, con resumen en inglés en el README. Nombres de herramientas e
  identificadores de código en inglés (estables, ASCII). Descripciones de herramientas y mensajes de error
  en español.
