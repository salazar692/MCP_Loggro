# MCP_Loggro

🇨🇴 Servidor [MCP](https://modelcontextprotocol.io) de código abierto para **consultar** datos de
[Loggro](https://loggro.com) desde asistentes de IA, de forma segura y solo lectura.
🇺🇸 Open-source, read-only MCP server that lets AI assistants query business data from Loggro
(Colombian business software) through the Model Context Protocol.

> [!IMPORTANT]
> **Estado: versión 0.1.0 en validación.** Las 8 herramientas de Restobar están implementadas y
> probadas sin red. Falta verificarlas contra la API real antes de publicar la primera versión.
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

Todas son de **solo lectura en Loggro**. Las fechas se escriben como `YYYY-MM-DD` en la zona horaria
del negocio (por defecto `America/Bogota`).

| Herramienta | Para qué sirve |
| --- | --- |
| `restobar_list_invoices` | Buscar facturas por fechas, estado, tipo, cliente, número o método de pago |
| `restobar_get_invoice` | Ver una factura: productos, cantidades, precios, cajero y estado DIAN |
| `restobar_list_products` | Buscar productos por nombre, código de barras o categoría, con stock y precios |
| `restobar_list_categories` | Listar categorías de productos |
| `restobar_list_payment_methods` | Listar métodos de pago |
| `restobar_list_orders` | Buscar pedidos por fechas, estado, mesa o producto |
| `restobar_list_clients` | Buscar clientes por nombre, documento o teléfono |
| `restobar_clients_summary` | Cifras de todos los clientes: total, datos de contacto, nuevos por mes, ciudades |
| `restobar_export_clients` | Guardar todos los clientes en un Excel (`.xlsx`) en tu computador |
| `restobar_sales_by_day` | Total facturado por día en un rango de fechas |

**Listados grandes.** Un chat no puede mostrar miles de registros: sería lento, costoso y se cortaría.
Cuando un listado supera 200 resultados, el servidor se lo advierte al asistente y le indica qué
hacer en su lugar: exportar a Excel, pedir un resumen o filtrar. La exportación descarga los clientes
en lotes de 500 (máximo 50 000) y guarda el archivo **en tu computador, sin pasar los datos por el
chat**; al asistente solo le llegan la ruta del archivo y el número de filas. Nunca sobrescribe un
archivo existente, y tu cliente MCP puede pedirte confirmación antes de crearlo, porque es la única
herramienta que escribe algo (en tu equipo, nunca en Loggro).

Diseño y catálogo planeado en [`docs/tool-design.md`](docs/tool-design.md).

## Requisitos

- Node.js **22.18 o superior** (probado en 22 y 24).
- Para usar el servidor, cuando exista: acceso a **Restobar**, con un token o con usuario y contraseña.
  Si puedes, crea un usuario dedicado con permisos mínimos.

## Instalación y configuración

Mientras no se publique en npm, se instala desde el código fuente:

```bash
git clone https://github.com/salazar692/MCP_Loggro.git
cd MCP_Loggro
npm ci && npm run build
```

**Claude Desktop:** agrega el servidor en el archivo de configuración de Claude Desktop
(`claude_desktop_config.json`), con la ruta absoluta a `dist/index.js`:

```json
{
  "mcpServers": {
    "loggro-restobar": {
      "command": "node",
      "args": ["/ruta/a/MCP_Loggro/dist/index.js"],
      "env": { "LOGGRO_RESTOBAR_TOKEN": "tu-token-de-restobar" }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add loggro-restobar -e LOGGRO_RESTOBAR_TOKEN=tu-token -- node /ruta/a/MCP_Loggro/dist/index.js
```

Si tienes varias sucursales, cada una con su propio token, agrega un servidor por sucursal
(p. ej. `loggro-centro` y `loggro-norte`).

Variables de entorno (ver [`.env.example`](.env.example)):

| Variable | Descripción |
| --- | --- |
| `LOGGRO_RESTOBAR_TOKEN` | Opción 1: token de Restobar ya obtenido. No guarda contraseña. |
| `LOGGRO_RESTOBAR_EMAIL` / `LOGGRO_RESTOBAR_PASSWORD` | Opción 2: usuario de Restobar; el servidor obtiene el token con `POST /login`. |
| `LOGGRO_RESTOBAR_BASE_URL` | URL base oficial, `https://api.pirpos.com`. |
| `LOGGRO_REDACT_PERSONAL_DATA` | `true` para ocultar documento, correo, teléfono y dirección de clientes y proveedores. |
| `LOGGRO_TIMEZONE` | Zona horaria para interpretar las fechas. Por defecto `America/Bogota`. |
| `LOGGRO_EXPORT_DIR` | Carpeta donde se guardan las exportaciones (ruta absoluta; admite `~`). Por defecto `Descargas/MCP-Loggro` (`~/Downloads/MCP-Loggro`). |
| `LOG_LEVEL` | `debug`, `info`, `warn` o `error` (los logs van siempre a stderr). |

El token es la opción recomendada: la contraseña no queda guardada en la configuración del cliente.

Nunca subas credenciales reales al repositorio. Detalles en [`docs/security.md`](docs/security.md).

## Seguridad y privacidad

- **Solo lectura por diseño:** allowlist explícita de endpoints verificada contra la documentación
  oficial, sin método genérico de solicitud y con anotaciones MCP `readOnlyHint`.
- **Credenciales:** solo por variables de entorno; el token vive únicamente en memoria; nunca se
  registra en logs ni se devuelve al modelo.
- **Datos:** todo lo que devuelvan las herramientas llega al proveedor del modelo de IA que uses,
  **incluidos los datos personales de tus clientes y proveedores** (documento, correo, teléfono). Tú
  decides si eso es aceptable para tu negocio; puedes ocultarlos con `LOGGRO_REDACT_PERSONAL_DATA=true`.
  La exportación a Excel es la excepción: guarda los datos en tu equipo sin pasarlos por el modelo
  (con `LOGGRO_REDACT_PERSONAL_DATA=true` el archivo tampoco incluye los datos personales).
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

**Prueba contra la API real** (opcional, con tu token): `node --env-file=.env scripts/smoke-restobar.ts`.
Solo usa el modo token (nunca hace login) y bloquea antes de la red cualquier método que no sea GET.
Hace como máximo 5 solicitudes por herramienta, acumuladas entre ejecuciones, e imprime solo tipos y
conteos, nunca datos.

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
