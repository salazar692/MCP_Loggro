# Preguntas abiertas

Documento vivo. Cuando una pregunta se resuelve se registra la respuesta (fecha y fuente) y, si cambia una
decisión, se actualiza [`decisions.md`](./decisions.md).

## A. Respuestas del propietario (2026-09-29)

| # | Pregunta | Respuesta | Efecto |
| --- | --- | --- | --- |
| A1 | ¿Negocio real o de prueba? | Negocio **real, en producción**. | Todo es solo consulta; las pruebas reales se hacen con cuidado (ADR-013). |
| A2 | ¿Usuario dedicado para el MCP? | **No es posible**; se usa el usuario propio de producción. | ADR-014; riesgos en [`security.md`](./security.md) §3. |
| A3 | ¿Excluir datos personales? | **No excluirlos.** Caso de uso: listado de clientes en Excel sin entrar a Loggro. | ADR-011 (incluidos, redacción opcional) y ADR-015 (exportación a archivo). |
| A4 | ¿Alcance de la fase 1? | Un MCP **funcional para cualquier persona**, cliente de Loggro o desarrollador, que use Restobar. | ADR-007 (instalación local por stdio). |
| A5 | ¿Relación con Loggro? | **Cliente de Loggro**, con API y varias automatizaciones. | Proyecto independiente; el README lo aclara. |
| A6 | ¿Madurez? | **Producción**, para quien lo instale con su token o su usuario y clave. | ADR-009 (npm, SemVer, releases). |
| A7 | ¿Público? | Cualquier persona interesada: empresas, desarrolladores y usuarios. | README y guías de instalación también para personas no técnicas. |

**Aceptadas por defecto** (propuestas anteriores sin objeción): PYMES como siguiente producto cuando
alguien pueda probarlo (A8); nombre `mcp-loggro` en npm (A9); idioma (A10, ADR-012); licencia MIT
(A11); reporte privado de vulnerabilidades de GitHub (A12); contribuciones externas con `main` protegida
(A13); pruebas con Claude Desktop, Claude Code y MCP Inspector (A14); Node 22 y 24 (A15); `pageSize`
máximo 50 y rango de 93 días (A16); zona horaria `America/Bogota` configurable (A17); pruebas de
integración solo manuales (A18).

## B. No documentado por Loggro: confirmar con Loggro o en pruebas reales

| # | Tema | Cómo resolverlo |
| --- | --- | --- |
| B1 | Duración del token de Restobar (`tokenCurrent`) y mensaje exacto al expirar. | Experiencia del propietario con sus automatizaciones (C1), o leer `exp` del JWT propio sin registrarlo. |
| B2 | **Crítico:** ¿un login nuevo en Restobar invalida los tokens anteriores del mismo usuario? Con el usuario de producción, podría cerrar la sesión del POS o romper automatizaciones. La documentación solo describe `POST /login` → `tokenCurrent`: no hay endpoint para crear tokens adicionales o con nombre, ni para renovar o revocar. 🔎 `lastTokenDevice` no es un segundo token de API: su ejemplo es `fcm_token_example`, un token de notificaciones push del dispositivo. 🔎 El nombre `tokenCurrent` («token actual») sugiere que el servidor guarda uno vigente por usuario, pero no lo prueba. | Sin riesgo: en la próxima renovación semanal, antes de reemplazar el token viejo en las automatizaciones, correr `scripts/smoke-restobar.ts restobar_list_categories` con el token **viejo** (1 solicitud). Si responde bien, conviven varios tokens; si da 401 antes de su `exp`, un login invalida el anterior. |
| B3 | Límites de peticiones de Restobar. | Consultar a Loggro. No hacer pruebas de carga contra producción. |
| B4 | Zona horaria con la que Restobar aplica `dateInit`/`dateEnd`. | Prueba real con facturas de horas conocidas cerca de medianoche. |
| B5 | Qué ocurre al superar el `limit` máximo (error o recorte). | Consultar a Loggro; no hace falta probarlo si el MCP nunca supera el máximo. |
| B6 | Código de permiso necesario para `GET /invoices` y `GET /orders` (el `403` no lo nombra). | Solo importa a quienes usen roles restringidos; documentar lo que se observe. |
| B7 | Moneda de los montos en Restobar. | Consultar a Loggro. |
| B8 | ¿Ofrece Restobar un token de integración de larga duración (como PYMES o Nómina)? | Consultar a Loggro. Sería más seguro que usuario y clave. |
| B9 | ¿Hay entorno de pruebas (sandbox) para Restobar? | Consultar a Loggro. |
| B10 | Términos de uso de la API: ¿permiten herramientas de terceros de código abierto y enviar datos a proveedores de IA? | Consultar a Loggro. |
| B11 | Semántica de `allBusiness` y de los negocios padre/hijo. | Prueba real si el negocio tiene sucursales (C6). |
| B12 | Nómina: ¿los GET «Calcular …» persisten resultados? | Solo relevante si algún día se incluye Nómina. |

## C. Respuestas del propietario (2026-09-29, segunda ronda)

| # | Respuesta | Efecto |
| --- | --- | --- |
| C1 | Sus automatizaciones obtienen el token con `POST /login` (usuario y clave) y lo **renuevan cada semana**. No sabe si un login nuevo invalida el token anterior. | 🔎 El token dura al menos una semana; `scripts/smoke-restobar.ts` imprime su vigencia real sin revelarlo. Las pruebas usan el token actual (modo token, **sin login**) para no arriesgar las automatizaciones. B2 sigue abierta. |
| C2 | Plan **premium**. | Se pueden verificar reportes y el historial de cuadres de caja. |
| C3 | Pruebas reales desde el chat de Claude Code. | El token se configura como variable de entorno del entorno en la nube (nunca pegado en el chat); la variable la toma una sesión nueva. Reglas del propietario: entre 1 y 5 solicitudes por herramienta, solo lectura, nada que modifique. `scripts/smoke-restobar.ts` las hace cumplir. |
| C4 | Preguntó dónde quedarían los archivos exportados. | Explicado: con Claude Desktop, el servidor corre en su equipo y guardaría el archivo en una carpeta local; la alternativa es que Claude arme el Excel en el chat. La decisión (ADR-015) depende del número de clientes, que dará la prueba real. |
| C5 | Propone recibir reportes por GitHub. | GitHub no ofrece mensajes privados y los reportes de conducta no deben ser públicos. Se pospone el Código de Conducta hasta que haya comunidad o un correo del proyecto. |
| C6 | Tiene **varias sucursales, cada una con su propio token**. | Hoy: un servidor por sucursal en el cliente MCP. Propuesta: soporte multi-sucursal en un solo servidor (ADR-016). |

## D. Preguntas pendientes para el propietario (histórico)

Las preguntas de esta sección se respondieron en la sección C.

| # | Pregunta | Por qué importa |
| --- | --- | --- |
| C1 | ¿Cómo obtienen el token tus automatizaciones actuales? ¿Con `POST /login` y este mismo usuario? ¿Has visto que un login en otro lugar invalide un token? ¿Cuánto dura el token en tu experiencia? | Resuelve B1 y B2 sin experimentar en producción. |
| C2 | ¿Qué plan tiene tu negocio en Restobar (premium o no)? | Los reportes y el historial de cuadres de caja requieren premium; define qué herramientas se pueden verificar. |
| C3 | ¿Dónde ejecutamos las pruebas contra producción? Propuesta: **tú, en tu equipo**, con un comando de solo lectura que no imprime datos. Alternativa: guardar las credenciales como secretos del entorno de Claude Code en la nube. | Las credenciales y los datos reales no deberían salir de tu equipo sin necesidad. |
| C4 | Exportación: ¿basta con `.xlsx` o también quieres `.csv`? ¿En qué carpeta deben guardarse por defecto? | Define ADR-015. |
| C5 | ¿Qué nombre va como titular del copyright (hoy «Andrew») y qué contacto publicamos para el Código de Conducta? | Proyecto público en producción: conviene tener Código de Conducta con contacto real. |
| C6 | ¿Tu negocio tiene sucursales (negocio padre e hijos) en Restobar? | Define si hay que soportar `allBusiness` desde la fase 1. |
