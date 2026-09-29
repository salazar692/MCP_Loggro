# Inventario de endpoints — Nómina Sipe

> Generado por `scripts/sync-loggro-docs.ts` a partir de la documentación oficial
> (https://developer.loggro.com/llms.txt) el 2026-09-29. **No editar a mano**: volver a ejecutar el script.
> Resúmenes y parámetros son transcripción literal del OpenAPI oficial; la columna
> «Clase» es una clasificación de este proyecto (ver `docs/loggro-api/README.md`).

- **Operaciones:** 2
- **Por clase:** lectura 1 · escritura 1
- **URL base declarada en OpenAPI:** `https://api.loggro.com/apik/loggro-sipe`
- **Esquemas de seguridad declarados en OpenAPI:** `bearerAuth: http/bearer`

| Clase | Método | Ruta | Resumen oficial | Obligatorios | Opcionales | Paginación | Códigos HTTP | Notas | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lectura | GET | `/estudioVacaciones` | Consultar Estudio de Vacaciones | `empleado` `fechaCorte` | `detallado` |  | 200 400 404 500 |  | [consultarestudiovacaciones](https://developer.loggro.com/reference/consultarestudiovacaciones) 2026-09-22 |
| escritura | POST | `/reporteLabores` | Crear Reporte de Labores | body (application/json) |  |  | 201 400 404 500 |  | [reportelabores](https://developer.loggro.com/reference/reportelabores) 2026-09-22 |
