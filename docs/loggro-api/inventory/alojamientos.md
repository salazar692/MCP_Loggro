# Inventario de endpoints — ALOJAMIENTOS

> Generado por `scripts/sync-loggro-docs.ts` a partir de la documentación oficial
> (https://developer.loggro.com/llms.txt) el 2026-09-29. **No editar a mano**: volver a ejecutar el script.
> Resúmenes y parámetros son transcripción literal del OpenAPI oficial; la columna
> «Clase» es una clasificación de este proyecto (ver `docs/loggro-api/README.md`).

- **Operaciones:** 9
- **Por clase:** autenticación 3 · lectura 4 · entrante 1 · escritura 1
- **URL base declarada en OpenAPI:** `https://aos.ayenda.co`, `http://localhost:3000`, `http://staging-aos.ayenda.co`
- **Esquemas de seguridad declarados en OpenAPI:** `bearerAuth: http/bearer`

| Clase | Método | Ruta | Resumen oficial | Obligatorios | Opcionales | Paginación | Códigos HTTP | Notas | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| autenticación | POST | `/api/v1/sessions` | Iniciar sesión con OTP |  | body (application/json) |  | 200 401 |  | [post_api-v1-sessions](https://developer.loggro.com/reference/post_api-v1-sessions) 2026-07-24 |
| autenticación | DELETE | `/api/v1/sessions` | Cerrar sesión |  |  |  | 204 401 |  | [delete_api-v1-sessions](https://developer.loggro.com/reference/delete_api-v1-sessions) 2026-07-24 |
| autenticación | POST | `/api/v1/sessions/send_otp` | Enviar OTP |  | body (application/json) |  | 200 401 429 503 |  | [post_api-v1-sessions-send-otp](https://developer.loggro.com/reference/post_api-v1-sessions-send-otp) 2026-07-24 |
| lectura | GET | `/api/status` | Health check del servidor |  |  |  | 200 |  | [get_api-status](https://developer.loggro.com/reference/get_api-status) 2026-07-17 |
| entrante | POST | `/api/otas/booking/diagnostics` | Diagnóstico de conectividad Booking.com | body (application/json) |  |  | 201 |  | [post_api-otas-booking-diagnostics](https://developer.loggro.com/reference/post_api-otas-booking-diagnostics) 2026-07-17 |
| lectura | GET | `/api/v1/hotels/reservations` | Listar reservas del hotel |  | `stage` `search_all_date_fields[start_date]` `search_all_date_fields[end_date]` `pre_reservations` `post_reservations` | `limit` (def 20, máx 50) `page` (def 1) headers `Total-Count`… | 200 401 422 |  | [get_api-v1-hotels-reservations](https://developer.loggro.com/reference/get_api-v1-hotels-reservations) 2026-07-24 |
| escritura | POST | `/api/v1/external_consumptions` | Registrar consumo del huésped |  | body (application/json) |  | 200 201 400 401 422 | `X-Api-Key` | [post_api-v1-external-consumptions](https://developer.loggro.com/reference/post_api-v1-external-consumptions) 2026-07-24 |
| lectura | GET | `/api/v1/reservations/find_by` | Consultar reservas activas por documento | `hotel_id` `identification_number` |  |  | 200 400 401 404 | `X-Api-Key` | [get_api-v1-reservations-find-by](https://developer.loggro.com/reference/get_api-v1-reservations-find-by) 2026-07-24 |
| lectura | GET | `/api/v1/hotels/find_by` | Consultar hotel por número de documento | `hotel_document_number` |  |  | 200 400 401 404 | `X-Api-Key` | [get_api-v1-hotels-find-by](https://developer.loggro.com/reference/get_api-v1-hotels-find-by) 2026-08-18 |
