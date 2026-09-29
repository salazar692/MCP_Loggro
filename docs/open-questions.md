# Preguntas abiertas

Documento vivo. Cuando una pregunta se resuelva, se registra la respuesta (fecha y fuente) y, si cambia una
decisión, se actualiza [`decisions.md`](./decisions.md).

## A. Para el propietario del proyecto

### Alta prioridad (condicionan el diseño)

| # | Pregunta | Por qué importa |
| --- | --- | --- |
| A1 | ¿Las credenciales de Restobar son de un negocio real con operación o de uno de prueba? ¿Qué plan tiene (trial, gratuito, premium)? | Trial solo ve 24 h de clientes, facturas y pedidos; gratuito, 30 días de ventas; los reportes exigen premium. Define qué se puede probar. |
| A2 | ¿Puedes crear en Restobar un **usuario dedicado** para el MCP y asignarle un rol con permisos mínimos? ¿Ese usuario se usa también en el POS? | Mínimo privilegio y riesgo de cerrar la sesión de una persona si un login nuevo invalida el anterior (no documentado). |
| A3 | ¿Excluimos por defecto documento, teléfono, correo, dirección y fecha de nacimiento de clientes y proveedores? ¿Debe existir una opción para activarlos? | Privacidad de terceros frente a utilidad (ADR-011). |
| A4 | ¿La fase 1 es solo local (el usuario ejecuta el servidor en su máquina con Claude Desktop o Claude Code)? ¿Hay planes de un servidor remoto o multiusuario? | Un servidor remoto cambia por completo el modelo de seguridad (OAuth, aislamiento de credenciales). |
| A5 | ¿Cuál es tu relación con Loggro? (proyecto independiente, cliente, empleado, partner) ¿Loggro conoce o respalda el proyecto? | Uso de la marca «Loggro», aviso de «proyecto no oficial» y posibilidad de consultar a Loggro lo no documentado. |
| A6 | ¿Qué nivel de madurez esperas? ¿Experimental y personal, o apto para que terceros lo usen en producción? | Define la exigencia de pruebas, versionado, soporte y política de seguridad. |
| A7 | ¿Quién es el público principal? (tú mismo, negocios que usan Restobar, contadores, desarrolladores de agentes) | Orienta el tono del README, el catálogo de herramientas y la documentación de instalación. |

### Media prioridad

| # | Pregunta | Propuesta por defecto |
| --- | --- | --- |
| A8 | Después de Restobar, ¿qué producto sigue? (PYMES parece el de mayor valor para contadores y equipos financieros; su token se genera en la aplicación) | PYMES |
| A9 | ¿Publicamos en npm para instalar con `npx`? ¿Con qué nombre? | `mcp-loggro`, SemVer desde `0.1.0`, con releases en GitHub |
| A10 | Idioma: ¿documentación en español con resumen en inglés, nombres de herramientas en inglés y descripciones en español? | Sí (ADR-012) |
| A11 | Licencia MIT con titular «Andrew»: ¿es el nombre que quieres en el copyright? | Mantener MIT |
| A12 | ¿Qué canal de contacto se publica para reportes de conducta (Código de Conducta) y de seguridad? ¿Activamos el reporte privado de vulnerabilidades de GitHub? | Reporte privado de GitHub para seguridad; el Código de Conducta se crea cuando haya contacto |
| A13 | ¿Aceptas contribuciones externas desde ya? ¿Proteges la rama `main` (PR obligatorio y CI en verde)? | Sí, con protección de `main` |
| A14 | Además de Claude, ¿qué clientes MCP quieres soportar explícitamente? (Cursor, VS Code, otros) | Probar con Claude Desktop, Claude Code y MCP Inspector |

### Baja prioridad

| # | Pregunta | Propuesta por defecto |
| --- | --- | --- |
| A15 | ¿Soportamos Node 22 y 24? | Sí |
| A16 | ¿Límites propios: `pageSize` máximo 50 y rango de fechas máximo 93 días? | Sí, ajustables |
| A17 | ¿Zona horaria por defecto `America/Bogota` para interpretar «hoy» o «esta semana»? ¿Hay negocios fuera de Colombia? | `America/Bogota`, configurable |
| A18 | ¿Quieres pruebas de integración automáticas en CI más adelante (con secretos en un entorno protegido de GitHub)? | Solo manuales en la fase 1 |

## B. No documentado por Loggro: confirmar con Loggro o en pruebas reales

| # | Tema | Cómo resolverlo |
| --- | --- | --- |
| B1 | Duración del token de Restobar (`tokenCurrent`) y mensaje exacto al expirar. | Prueba real: decodificar `exp` del JWT propio (sin registrarlo) y observar el `401`. |
| B2 | ¿Un login nuevo en Restobar invalida los tokens anteriores del mismo usuario? | Prueba real con dos logins sucesivos del usuario dedicado. |
| B3 | Límites de peticiones de Restobar (y de PYMES, Enterprise y Nómina). | Consultar a Loggro. No hacer pruebas de carga contra producción. |
| B4 | Zona horaria con la que Restobar aplica `dateInit`/`dateEnd`. | Prueba real con facturas de horas conocidas cerca de medianoche. |
| B5 | Qué ocurre al superar el `limit` máximo (error o recorte). | Prueba real con un valor alto, o consulta a Loggro. |
| B6 | Código de permiso necesario para `GET /invoices` y `GET /orders` (el `403` no lo nombra) y permisos mínimos de un rol de solo lectura. | Prueba real con un rol restringido. |
| B7 | Moneda de los montos en Restobar. | Consultar a Loggro. |
| B8 | ¿Ofrece Restobar un token de integración (como PYMES o Nómina) en lugar de correo y contraseña? | Consultar a Loggro. Sería más seguro. |
| B9 | ¿Hay entorno de pruebas (sandbox) para Restobar? | Consultar a Loggro. Solo se documentan entornos de prueba para Alojamientos y Documentos Electrónicos. |
| B10 | Términos de uso de la API: ¿permiten herramientas de terceros de código abierto y el envío de datos a proveedores de IA? | Consultar a Loggro. No aparece en el portal para desarrolladores. |
| B11 | Semántica de `allBusiness` y de los negocios padre/hijo. | Prueba real si el negocio tiene sucursales. |
| B12 | Nómina: ¿los GET «Calcular …» (`/pagos/pagarNominaPeriodica`, …) persisten resultados? | Consultar a Loggro antes de considerar Nómina. |
