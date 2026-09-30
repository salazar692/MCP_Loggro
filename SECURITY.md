# Política de seguridad

## Versiones soportadas

MCP_Loggro está en fase de preparación y todavía no tiene versiones publicadas. Cuando existan, esta
sección indicará qué versiones reciben correcciones de seguridad.

## Cómo reportar una vulnerabilidad

**No abras un issue público.** Usa el reporte privado de GitHub: pestaña **Security** →
**Report a vulnerability** en <https://github.com/salazar692/MCP_Loggro_Restobar/security/advisories/new>.

Incluye, si es posible: descripción, impacto, pasos para reproducir y versión o commit afectado.
**No incluyas credenciales ni datos reales de Loggro**; si hacen falta para reproducir el problema,
descríbelos sin copiarlos.

## Alcance

Se consideran vulnerabilidades, entre otras:

- Cualquier forma de **escribir, modificar o eliminar** datos en Loggro a través del servidor.
- Exposición de credenciales o tokens (en logs, errores, respuestas al modelo o archivos).
- Exposición de datos personales que deberían estar excluidos por defecto.
- Formas de hacer que el servidor contacte hosts distintos de las URL oficiales de Loggro.

Los fallos o comportamientos de las APIs de Loggro deben reportarse a Loggro
(<servicio@loggro.com>, según su documentación).

## Si expusiste una credencial

1. Cambia de inmediato la contraseña del usuario de Restobar (o regenera el token del producto afectado).
2. Revisa la actividad reciente en Loggro.
3. Si la credencial llegó a un commit, cambiarla es obligatorio: reescribir el historial no basta.

El diseño de seguridad completo está en [`docs/security.md`](docs/security.md).
