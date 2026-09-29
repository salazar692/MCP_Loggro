# MCP_Loggro

🇨🇴 Servidor [MCP](https://modelcontextprotocol.io) de código abierto para **consultar** datos de
[Loggro](https://loggro.com) desde asistentes de IA, de forma segura y solo lectura.
🇺🇸 Open-source, read-only MCP server that lets AI assistants query business data from Loggro
(Colombian business software) through the Model Context Protocol.

> [!IMPORTANT]
> **Estado: fase de preparación.** Todavía **no hay herramientas MCP implementadas**. El repositorio
> contiene la investigación de la API oficial, la arquitectura propuesta y la infraestructura de
> desarrollo. La documentación oficial de Loggro está en <https://developer.loggro.com>.

## ¿Qué es?

- **Loggro** es una familia de productos de software empresarial colombiano: Restobar (restaurantes y
  bares), PYMES, Enterprise, Nómina, Documentos Electrónicos DIAN y Alojamientos, entre otros.
  Cada producto tiene **su propia API y su propia autenticación**.
- **MCP_Loggro** expondrá esas APIs como herramientas MCP para que Claude y otros clientes compatibles
  respondan preguntas como «¿qué facturas quedaron pendientes ayer?» o «¿cuánto stock queda de este
  producto?», **sin poder modificar nada**.

## Alcance

| Incluido (fase 1) | Excluido |
| --- | --- |
| Consultas de solo lectura sobre **Restobar** | Crear, modificar, eliminar o anular registros |
| Ejecución local por stdio (Claude Desktop, Claude Code, …) | Operaciones financieras o irreversibles |
| Credenciales del propio usuario, solo en variables de entorno | Servidor remoto o multiusuario |

Otros productos (PYMES, Nómina, …) se evaluarán después. Ver el
[informe de la API](docs/loggro-api/README.md).

## Herramientas disponibles

Ninguna todavía. El catálogo **propuesto** para Restobar está en
[`docs/tool-design.md`](docs/tool-design.md).

## Requisitos

- Node.js **22.18 o superior** (probado en 22 y 24).
- Para usar el servidor, cuando exista: una cuenta de **Restobar** y, preferiblemente, un usuario
  dedicado con permisos mínimos.

## Instalación y configuración

El servidor todavía no es ejecutable. La configuración planeada se documenta en
[`.env.example`](.env.example):

| Variable | Descripción |
| --- | --- |
| `LOGGRO_RESTOBAR_EMAIL` / `LOGGRO_RESTOBAR_PASSWORD` | Usuario de Restobar con el que se obtiene el token (`POST /login`). |
| `LOGGRO_RESTOBAR_BASE_URL` | URL base oficial, `https://api.pirpos.com`. |
| `LOG_LEVEL` | `debug`, `info`, `warn` o `error` (los logs van siempre a stderr). |

Nunca subas credenciales reales al repositorio. Detalles en [`docs/security.md`](docs/security.md).

## Seguridad y privacidad

- **Solo lectura por diseño:** allowlist explícita de endpoints verificada contra la documentación
  oficial, sin método genérico de solicitud y con anotaciones MCP `readOnlyHint`.
- **Credenciales:** solo por variables de entorno; el token vive únicamente en memoria; nunca se
  registra en logs ni se devuelve al modelo.
- **Datos:** todo lo que devuelvan las herramientas llega al proveedor del modelo de IA que uses.
  Los datos personales de clientes y proveedores se excluirán por defecto.
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
