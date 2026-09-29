# MCP_Loggro

🇨🇴 Servidor [MCP](https://modelcontextprotocol.io) de código abierto para **consultar** datos de
[Loggro](https://loggro.com) desde asistentes de IA, de forma segura y solo lectura.
🇺🇸 Open-source, read-only MCP server that lets AI assistants query business data from Loggro
(Colombian business software) through the Model Context Protocol.

> [!IMPORTANT]
> **Estado: fase de preparación.** Todavía **no hay herramientas MCP implementadas**. El repositorio
> contiene la investigación de la API oficial, la arquitectura propuesta y la infraestructura de
> desarrollo.
>
> Proyecto **independiente**, creado por un cliente de Loggro. No es un producto oficial de Loggro S.A.S.
> ni está afiliado a ella. La documentación oficial de Loggro está en <https://developer.loggro.com>.

## ¿Qué es?

- **Loggro** es una familia de productos de software empresarial colombiano: Restobar (restaurantes y
  bares), PYMES, Enterprise, Nómina, Documentos Electrónicos DIAN y Alojamientos, entre otros.
  Cada producto tiene **su propia API y su propia autenticación**.
- **MCP_Loggro** expondrá esas APIs como herramientas MCP para que Claude y otros clientes compatibles
  respondan preguntas como «¿qué facturas quedaron pendientes ayer?», «¿cuánto stock queda de este
  producto?» o «exporta mis clientes a Excel», **sin poder modificar nada en Loggro**.
- Está pensado para cualquier negocio que use Restobar, para sus equipos y para desarrolladores que
  construyan agentes sobre Loggro.

## Alcance

| Incluido (fase 1) | Excluido |
| --- | --- |
| Consultas de solo lectura sobre **Restobar** | Crear, modificar, eliminar o anular registros |
| Ejecución local por stdio (Claude Desktop, Claude Code, …) | Operaciones financieras o irreversibles |
| Credenciales del propio usuario, solo en variables de entorno | Servidor remoto o multiusuario |

Solo se publica lo que se ha probado contra la API real. Hoy eso es Restobar; los demás productos
(PYMES, Nómina, …) están documentados en el [informe de la API](docs/loggro-api/README.md), pero no se
implementarán hasta que alguien con acceso pueda verificarlos.

## Herramientas disponibles

Ninguna todavía. El catálogo **propuesto** para Restobar está en
[`docs/tool-design.md`](docs/tool-design.md).

## Requisitos

- Node.js **22.18 o superior** (probado en 22 y 24).
- Para usar el servidor, cuando exista: acceso a **Restobar**, con un token o con usuario y contraseña.
  Si puedes, crea un usuario dedicado con permisos mínimos.

## Instalación y configuración

El servidor todavía no es ejecutable. La configuración planeada se documenta en
[`.env.example`](.env.example):

| Variable | Descripción |
| --- | --- |
| `LOGGRO_RESTOBAR_TOKEN` | Opción 1: token de Restobar ya obtenido. No guarda contraseña. |
| `LOGGRO_RESTOBAR_EMAIL` / `LOGGRO_RESTOBAR_PASSWORD` | Opción 2: usuario de Restobar; el servidor obtiene el token con `POST /login`. |
| `LOGGRO_RESTOBAR_BASE_URL` | URL base oficial, `https://api.pirpos.com`. |
| `LOGGRO_REDACT_PERSONAL_DATA` | `true` para ocultar documento, correo, teléfono y dirección de clientes y proveedores. |
| `LOGGRO_EXPORT_DIR` | Carpeta donde se guardan las exportaciones a Excel. |
| `LOG_LEVEL` | `debug`, `info`, `warn` o `error` (los logs van siempre a stderr). |

Nunca subas credenciales reales al repositorio. Detalles en [`docs/security.md`](docs/security.md).

## Seguridad y privacidad

- **Solo lectura por diseño:** allowlist explícita de endpoints verificada contra la documentación
  oficial, sin método genérico de solicitud y con anotaciones MCP `readOnlyHint`.
- **Credenciales:** solo por variables de entorno; el token vive únicamente en memoria; nunca se
  registra en logs ni se devuelve al modelo.
- **Datos:** todo lo que devuelvan las herramientas llega al proveedor del modelo de IA que uses,
  **incluidos los datos personales de tus clientes y proveedores** (documento, correo, teléfono). Tú
  decides si eso es aceptable para tu negocio; puedes ocultarlos con `LOGGRO_REDACT_PERSONAL_DATA=true`.
  Las exportaciones a Excel se escriben en tu equipo y no pasan por el modelo.
- **Prompt injection:** el contenido de Loggro (nombres, notas, descripciones) se trata como dato, nunca
  como instrucción.

Para reportar vulnerabilidades, ver [`SECURITY.md`](SECURITY.md).

## Limitaciones conocidas

- La API de Restobar **no documenta** duración del token, límites de peticiones ni zona horaria de
  los filtros de fecha. Se validarán con pruebas reales ([`docs/open-questions.md`](docs/open-questions.md)).
- Las cuentas trial o gratuitas de Restobar limitan el historial visible (24 h o 30 días) y los
  reportes requieren plan premium.

## Desarrollo

```bash
npm ci                 # instala dependencias exactas
npm run check          # formato, lint, tipos, pruebas y build (lo mismo que la CI)
npm test               # solo pruebas
npm run docs:sync      # regenera docs/loggro-api/inventory desde la documentación oficial
```

| Documento | Contenido |
| --- | --- |
| [`docs/loggro-api/README.md`](docs/loggro-api/README.md) | Investigación de la API oficial: productos, autenticación, paginación, errores y límites |
| [`docs/loggro-api/inventory/`](docs/loggro-api/inventory/README.md) | Inventario de los 629 endpoints documentados, con clasificación de lectura o escritura |
| [`docs/architecture.md`](docs/architecture.md) | Arquitectura, flujo de datos, manejo de errores y estrategia de pruebas |
| [`docs/security.md`](docs/security.md) | Modelo de amenazas, credenciales y privacidad |
| [`docs/tool-design.md`](docs/tool-design.md) | Principios y catálogo propuesto de herramientas |
| [`docs/decisions.md`](docs/decisions.md) | Decisiones técnicas y justificación de dependencias |
| [`docs/open-questions.md`](docs/open-questions.md) | Preguntas abiertas y lo que Loggro no documenta |

## Contribuir

Lee [`CONTRIBUTING.md`](CONTRIBUTING.md). La regla principal: **nada se implementa sin respaldo en
la documentación oficial de Loggro**.

## Licencia

[MIT](LICENSE). «Loggro» es una marca de su respectivo titular.
