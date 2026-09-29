# Investigación de la API de Loggro

Informe de la documentación oficial de Loggro, base para diseñar MCP_Loggro.

- **Fuente:** portal oficial <https://developer.loggro.com>, índice para agentes
  [`llms.txt`](https://developer.loggro.com/llms.txt) y la versión Markdown de cada página
  (653 páginas; 629 operaciones con definición OpenAPI).
- **Fecha de consulta:** 2026-09-29.
- **Inventario completo por endpoint:** [`inventory/`](./inventory/README.md), generado con
  `npm run docs:sync` (`scripts/sync-loggro-docs.ts`). Cada fila enlaza a su página oficial.

## Convención de certeza

Cada afirmación sobre Loggro lleva una de estas marcas:

| Marca | Significado |
| --- | --- |
| ✅ **CONFIRMADO** | Está escrito en la documentación oficial (se cita la página). |
| 🔎 **INFERIDO** | Deducción técnica a partir de lo documentado; debe validarse en pruebas reales. |
| ❓ **NO DOCUMENTADO** | La documentación no lo dice. No se asume ni se implementa. |

---

## 1. Hallazgo principal: «la API de Loggro» son varias APIs

✅ Loggro es un ecosistema de productos y _«cada uno maneja su propio esquema de autenticación
para el consumo de sus APIs»_ ([autenticacion](https://developer.loggro.com/reference/autenticacion)).
✅ Hay servicios REST y SOAP ([guia-de-uso](https://developer.loggro.com/docs/guia-de-uso)).

| Producto | Protocolo | URL base (OpenAPI oficial) | Credencial | Operaciones (lectura / total)¹ |
| --- | --- | --- | --- | --- |
| **Restobar** | REST / JSON | `https://api.pirpos.com` | Correo + contraseña de un usuario → `POST /login` → JWT `tokenCurrent` | 104 / 166 |
| **PYMES** | REST / JSON | `https://api.loggro.com/apik/loggro-{facturacion,financiero,organizacion,inventario,compras}` | Token generado en la aplicación | 63 / 89 |
| **Enterprise** | REST / JSON | `https://api.loggro.com/apik/loggro-enterprise` | Token generado en la aplicación, previa solicitud formal a Loggro | 39 / 69 |
| **Nómina** | REST / JSON | `https://api.loggro.com/apik/loggro-nomina/` | Token generado en la aplicación | 172 / 256 |
| **Nómina Sipe** | REST / JSON | `https://api.loggro.com/apik/loggro-sipe` | Token generado y enviado por Loggro | 1 / 2 |
| **Documentos Electrónicos** — Facturación Electrónica y Documento Soporte | SOAP (WSDL) | URL enviada por correo (`{urlServicio}`) | Usuario y contraseña del proyecto | 18 / 29 |
| **Documentos Electrónicos** — Nómina Electrónica | REST / JSON | URL devuelta por el servicio `/auth` | `POST /auth` → Bearer en cabecera de respuesta | 6 / 9 |
| **Alojamientos** (PMS) | REST / JSON | `https://aos.ayenda.co` | OTP por SMS/WhatsApp → Bearer de 1 h, o `X-Api-Key` | 4 / 9 |

¹ Clasificación de este proyecto (sección 6). «Lectura» incluye consultas que usan POST.

**Consecuencia de diseño:** no existe un «cliente Loggro» único. Cada producto necesita su propio
módulo de autenticación, configuración y manejo de errores. MCP_Loggro empieza por **Restobar**
porque es el único producto con credenciales de prueba disponibles
(ver [`../decisions.md`](../decisions.md)).

---

## 2. Restobar en detalle (producto piloto)

### 2.1 Autenticación

| Tema | Estado | Detalle |
| --- | --- | --- |
| Mecanismo | ✅ | `POST /login` con `{ email, password }` de un usuario registrado; la respuesta trae `tokenCurrent` (JWT). Enviar `Authorization: Bearer {tokenCurrent}` en las demás solicitudes ([iniciarsesion](https://developer.loggro.com/reference/iniciarsesion), [introduccion-restobar](https://developer.loggro.com/reference/introduccion-restobar)). |
| Respuesta de login | ✅ | Además del token devuelve datos del usuario: `_id`, `business`, `name`, `lastName`, `email`, `phone`, `role`, `isActive`, `lastAccess`, `lastTokenDevice`. **No deben llegar al modelo.** |
| Errores de login | ✅ | `400` con `message`: «Correo o contraseña incorrectos.», «Usuario inactivo», «Usuario de POS Tienda. Por favor ingrese a la aplicación correcta.» |
| Duración del token | ❓ | No documentada. 🔎 El JWT de ejemplo publicado tiene `exp − iat = 7200 s`, pero es el mismo ejemplo genérico que aparece en la página de Nómina: **no sirve como evidencia**. |
| Refresh / logout | ❓ | No hay endpoint documentado de refresh ni de cierre de sesión para Restobar. |
| Sesión única | ❓ | No se sabe si un login nuevo invalida el token anterior (en Alojamientos sí ocurre). **Riesgo:** si el MCP usa el mismo usuario que una persona en el POS, podría cerrarle la sesión. |
| Scopes | ❓ / 🔎 | No hay scopes documentados. 🔎 El token actúa con los permisos del rol del usuario. |
| Permisos por rol | ✅ | Muchos endpoints declaran «Permiso requerido» (`CB_GET_ALL`, `ST_GET_DASHBOARD`, `OR_GET_ALL`, `RO_GET_ALL`, …) y responden `403` sin él. |
| Permisos incoherentes | ✅ | Varias consultas por ID exigen permisos de **escritura**: `GET /clients/{id}` → `CL_POST` («Crear/Editar»), `GET /roles/{id}` → `RO_POST`, y también `/taxes/{id}`, `/promos/{id}`, `/events/{id}`, `/deliveryProviders/{id}`, `/waiterOrderAreas/{id}` e `/inventoryInvoicePayments/{id}`. Un rol estrictamente de lectura podría no poder usarlas. |
| Plan del negocio | ✅ | Reportes y estadísticas avanzadas requieren plan **premium** (`402` «Suscripción premium requerida»). Las cuentas **trial** solo ven clientes, facturas, pedidos y cuadres de las **últimas 24 horas**. Hay un mensaje de las cuentas **gratis** limitado a ventas de los **últimos 30 días**. |
| Multi-negocio | ✅ | Hay negocios padre/hijo: parámetro `allBusiness` en reportes y herencia de productos y clientes del negocio padre. |

### 2.2 Paginación (Restobar)

- ✅ Parámetros: `pagination` (boolean), `page` (**empieza en 0**) y `limit`.
- ✅ Con `pagination=true` la respuesta es `{ data: [...], count }`; sin paginación es un arreglo simple
  (documentado explícitamente en `/cashbox` y en el esquema de `/clients`, `/orders` e `/ingredients`).
- ✅ Los valores por defecto y máximos **cambian por endpoint**:
  `/clients` (def 10, máx 10000, paginación activada por defecto),
  `/invoices` (def 10, máx 5000), `/orders` (def 10, máx 3000), `/products` (def 10, máx 100, paginación
  **desactivada** por defecto), `/ingredients` (def 15000), `/inventory` (def 10000),
  `/cashbox` (def 1000; valores ≥ 1000 se ajustan a 1000; sin premium se fuerza a 1).
- ✅ Muchos listados no tienen paginación (`/providers`, `/taxes`, `/tables`, `/paymentMethods`, …) y devuelven la
  lista completa.
- 🔎 Fin de resultados: `(page + 1) × limit ≥ count`.
- ❓ Qué ocurre al superar el máximo (error o recorte) solo está documentado en `/cashbox`.
- ❓ No hay cursores documentados.

### 2.3 Fechas y zona horaria

- ✅ Los filtros de fecha usan `dateInit`/`dateEnd` o `dateInitISO`/`dateEndISO` en formato ISO 8601
  (ejemplos: `2025-08-01T00:00:00.000Z`).
- ❓ No se documenta cómo interpreta Restobar los límites del día (UTC frente a la hora de Colombia, UTC−5).
  Esto afecta preguntas como «ventas de hoy».

### 2.4 Errores (Restobar)

- ✅ Cuerpo uniforme: `{ "message": string }` para 400, 401, 402, 403, 404, 500 y 503.
- ✅ Los códigos no siempre son semánticos: `401` para «Pedido no encontrado» y para el límite de cuentas
  gratis; `500` para «No encontrado o pertenece al negocio principal!» y para rol no encontrado;
  `GET /clients/{id}` devuelve `null` (sin 404) si no existe.
- 🔎 El MCP no debe confiar solo en el código HTTP para explicar el error; debe combinar código y mensaje.

### 2.5 Datos sensibles en respuestas (Restobar)

| Endpoint | Campos sensibles (✅ según esquema oficial) |
| --- | --- |
| `/clients`, `/clients/{id}` | `document`, `idDocumentType`, `email`, `phone`, `address`, `birthdate` |
| `/providers`, `/providers/{id}` | `document`, `email`, `phone`, `address` |
| `/invoices`, `/invoices/{id}` y reportes de ventas | `client.phone`, `business.nit`, `business.address`, totales y medios de pago |
| `/tables`, `/tables/{id}`, `/tables/tableOrders` | `password` («Contraseña opcional de acceso a la mesa») |
| `POST /login` | `tokenCurrent`, `lastTokenDevice`, datos del usuario |

### 2.6 Endpoints excluidos de Restobar

- ✅ `GET /stats/pp/*` están marcados «(PirPos SuperAdmin)»: devuelven datos **de toda la plataforma**. Se excluyen.
- ✅ `GET /invoices/deliveryGuy/myDeliveries` es exclusivo del rol repartidor.

---

## 3. Autenticación de los demás productos

| Producto | Estado | Detalle |
| --- | --- | --- |
| PYMES | ✅ | Token generado en _Configuración → Organización → Integraciones_; `Authorization: Bearer {token}`; el OpenAPI declara `bearerFormat: JWT` ([autenticacion-pymes](https://developer.loggro.com/reference/autenticacion-pymes)). Las causas de `401` documentadas incluyen «ApiKey incorrecta», «Tenant no existe o está inactivo» y «Token incorrecto o expirado». ❓ Duración, revocación y scopes no documentados. |
| Enterprise | ✅ | Token generado en _Información Común → Instalación → Generación Token Servicios_. Requiere solicitud formal previa a `servicio@loggro.com` ([autenticacion-enterprise](https://developer.loggro.com/reference/autenticacion-enterprise)). ✅ Las creaciones van a tablas de entrada y se importan de forma asíncrona. ✅ `Consultar Cliente` busca en tablas definitivas y de entrada (campo `ubicacion`). |
| Nómina | ✅ | Token generado en _Configuración → Organización → Integración APIs_. ✅ **Las peticiones se ejecutan con los permisos del administrador del sistema, sin importar quién genera el token** ([autenticacion-nomina](https://developer.loggro.com/reference/autenticacion-nomina)). No hay forma documentada de limitar privilegios. |
| Nómina Sipe | ✅ | El token lo genera y envía el equipo de Loggro ([autenticacion-nomina-sipe](https://developer.loggro.com/reference/autenticacion-nomina-sipe)). |
| Facturación Electrónica / Documento Soporte | ✅ | SOAP con usuario y contraseña del proyecto; las URL de pruebas y producción se entregan por correo ([introduccion-facturacion-electronica](https://developer.loggro.com/reference/introduccion-facturacion-electronica)). |
| Nómina Electrónica | ✅ | `POST {urlServicio}/auth` con `usuario`, `pass` y `aplicacion="nominafe"`; el Bearer llega en la **cabecera** de la respuesta y la URL base en el campo `url` ([autenticarusuario](https://developer.loggro.com/reference/autenticarusuario)). |
| Alojamientos | ✅ | OTP por SMS/WhatsApp → Bearer válido **1 hora**. Un login nuevo invalida el anterior. Más de 5 intentos fallidos por hora → `429`. Las integraciones externas usan `X-Api-Key` ([autenticacion-alojamientos](https://developer.loggro.com/reference/autenticacion-alojamientos)). 🔎 El OTP exige intervención humana: **no es apto para un servidor MCP desatendido**. |

---

## 4. Paginación en los demás productos

| Producto | Esquema (✅ salvo indicación) |
| --- | --- |
| PYMES | `page` (base 1) + `limit` (def 20, **máx 100**, si se supera → `400`) y/o `offset`. La precedencia entre `offset` y `page` **cambia por endpoint**. `/v1/items` usa `pagina`/`tamano`. Respuesta `{ contenido, metadata: { order, pagination: { offset, limit, total } } }`. |
| Nómina | `offset` + `size` (def 20) + `sort` (`campo,asc`). ✅ `page`: «Sin efecto: el backend ignora este parámetro». Respuesta `{ contenido, error, advertencia }`. |
| Enterprise | Sin parámetros de paginación documentados; consultas por código. |
| Alojamientos | `page` (base 1) + `limit` (5–50, def 20). Los metadatos van en **cabeceras**: `Current-Page`, `Page-Limit`, `Total-Count`, `Total-Pages`. |
| Nómina Electrónica | Consulta por lotes de IDs. **Contradicción:** la descripción dice «hasta 300 documentos por petición» y el error `400` dice «máximo 100 comprobantes o 50 IDs». |

❓ Ningún producto documenta cursores.

---

## 5. Rate limiting

- ✅ Alojamientos: 5 intentos fallidos de login por hora → `429`.
- ✅ Nómina Electrónica declara `429` («Límite de peticiones excedido»), sin cifras.
- ❓ **Restobar, PYMES, Enterprise y Nómina no documentan límites**, ni cabeceras `Retry-After` o `X-RateLimit-*`.
- 🔎 Política prudente para el cliente: pocas solicitudes concurrentes, reintento con backoff
  exponencial solo en `429`/`503` y en errores de red, y respetar `Retry-After` si llega. Los
  reintentos son seguros porque todas las operaciones expuestas son de lectura.

---

## 6. Clasificación lectura / escritura

✅ **El método HTTP no basta para saber si una operación es de solo lectura:**

- **GET con efecto secundario** (Nómina): `GET /pagos/enviarComprobantesPagoNomina` («Enviar
  comprobantes de pago por correo»), `GET /pagoEmpleados/enviarComprobantePagoNominaEmpleado`,
  `GET /anticipo-cesantias/generarPago` y `GET /pagos/adelantarPagoNomina`.
- **GET «Calcular …» sin semántica documentada** (Nómina): `/pagos/pagarNominaPeriodica`, `/pagos/pagarPrima`,
  `/pagos/pagarCesantias`, … ❓ No se sabe si persisten resultados.
- **Consultas por POST**: los servicios SOAP `consultar*` de Documentos Electrónicos y
  `POST /v1/productos/disponibilidad-productos` de PYMES.
- **POST que parece consulta pero escribe**: `POST /products/verifyProductInheritanceCurrentBusiness`
  (Restobar) «Verifica **y actualiza**».
- **Endpoint «planeado»**: una página de PYMES (`GET /v1/formas-de-pago` con filtro `tipo`) describe
  una _«funcionalidad planeada, todavía no implementada»_.
- **Páginas con OpenAPI vacío** (3, Nómina): documentadas sin operación.

**Decisión:** MCP_Loggro usará una **lista explícita de operaciones permitidas** (allowlist), revisada
una por una contra la documentación. Nunca filtrará por método HTTP. Reglas completas en
`scripts/lib/loggro-docs.ts` (con pruebas) y clases en [`inventory/README.md`](./inventory/README.md).

---

## 7. Estructura de errores por producto

| Producto | Estructura (✅) |
| --- | --- |
| Restobar | `{ "message": string }` |
| PYMES | `{ "errores": [{ "codigo", "mensaje" }] }`; a veces `errores` es un objeto y no un arreglo; `401` sin cuerpo. Códigos como `objeto.no-existe` o `error.interno`. |
| Enterprise | `[{ identificacion, mensaje, operacionExitosa }]`; algunos `404` con el formato estándar de Spring (`timestamp`, `status`, `error`, `message`, `path`). `409` por integridad referencial. |
| Nómina | `{ contenido, error, advertencia }`; `417` para validación de negocio y también para falta de permisos; algunos `404` sin cuerpo, que _«también [se devuelven] si la consulta falla internamente»_. |
| Documentos Electrónicos | SOAP: `<ErrorRespuesta><mensajeError>…`; REST: `{ mensajesError: [...] }`; `401` con formato Spring. |
| Alojamientos | `{ "errors": { "code", "title", "details"? } }` con catálogo publicado. |

---

## 8. Recursos de negocio expuestos (solo lo documentado)

- **Restobar:** productos, categorías, ingredientes, movimientos de inventario, clientes, proveedores,
  proveedores de domicilio, facturas, pedidos, mesas, cajas registradoras, cuadres de caja, gastos,
  tipos de gasto, métodos de pago, impuestos, promociones, eventos, roles, unidades, reportes y estadísticas.
- **PYMES:** clientes, vendedores, ítems, lista de precios, disponibilidad de inventario, salidas de
  inventario, saldos (facturas, notas crédito, ingresos, anticipos), análisis de edades CxC/CxP, detalle de
  ventas y compras, cuentas contables, cuentas bancarias, tarjetas de crédito, cajas, conceptos comerciales,
  impuestos y retenciones, formas y medios de pago, consecutivos, establecimientos, bodegas, centros,
  monedas, unidades de negocio.
- **Enterprise:** clientes, proveedores, terceros, ítems, lotes, bodegas, pedidos, órdenes de compra,
  requisiciones, despachos, documentos CxP, comprobantes y cuentas contables, tesorería, catálogos
  (ciudades, países, monedas, …), roles de usuario.
- **Nómina:** empleados, vinculados, contratos, salarios, novedades, vacaciones, pagos, comprobantes,
  aportes, prestaciones, retención en la fuente, certificados, contabilidad de nómina, catálogos (EPS, ARL,
  fondos, bancos, …).
- **Documentos Electrónicos:** documentos electrónicos DIAN (facturas, notas, documento soporte, nómina
  electrónica), estados de notificación, acuses, resoluciones DIAN, documentos recibidos.
- **Alojamientos:** reservas, hoteles, consumos externos.

---

## 9. Inconsistencias detectadas en la documentación oficial

1. Alojamientos: la página de autenticación enlaza `/api/v2/sessions`, pero el OpenAPI publicado es `/api/v1/sessions`.
2. Alojamientos: el entorno de staging se publica como `http://` (sin TLS).
3. Nómina Electrónica: límite de «300 documentos» frente a «100 comprobantes o 50 IDs».
4. Restobar: consultas por ID que exigen permisos de creación o edición (sección 2.1).
5. Restobar: códigos HTTP no semánticos (sección 2.4).
6. PYMES: `errores` a veces es arreglo y a veces objeto; la precedencia `offset`/`page` varía.
7. PYMES: dos páginas describen `GET /v1/formas-de-pago` con contratos distintos (una es «planeada»).
8. Nómina: parámetro `page` presente pero ignorado por el backend.
9. La página general de autenticación enlaza «Autenticación Restobar» a `/reference/autenticacion-restobar`,
   que no existe en el índice. La autenticación de Restobar está en `iniciarsesion`.

Los asuntos que requieren confirmación de Loggro están en [`../open-questions.md`](../open-questions.md).
