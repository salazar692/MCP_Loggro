# Inventario de endpoints — Enterprise

> Generado por `scripts/sync-loggro-docs.ts` a partir de la documentación oficial
> (https://developer.loggro.com/llms.txt) el 2026-09-29. **No editar a mano**: volver a ejecutar el script.
> Resúmenes y parámetros son transcripción literal del OpenAPI oficial; la columna
> «Clase» es una clasificación de este proyecto (ver `docs/loggro-api/README.md`).

- **Operaciones:** 69
- **Por clase:** lectura 39 · escritura 30
- **URL base declarada en OpenAPI:** `https://api.loggro.com/apik/loggro-enterprise`
- **Esquemas de seguridad declarados en OpenAPI:** `bearerAuth: http/bearer`

| Clase | Método | Ruta | Resumen oficial | Obligatorios | Opcionales | Paginación | Códigos HTTP | Notas | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lectura | GET | `/cliente/{identificacion}` | Consultar Cliente | `{identificacion}` |  |  | 200 404 500 |  | [consultarcliente](https://developer.loggro.com/reference/consultarcliente) 2026-06-05 |
| escritura | POST | `/cliente` | Crear Cliente | body (application/json) |  |  | 201 400 404 500 |  | [crearcliente](https://developer.loggro.com/reference/crearcliente) 2026-06-05 |
| escritura | DELETE | `/cliente/{identificacion}` | Eliminar Cliente | `{identificacion}` | `establecimiento` |  | 200 404 409 500 |  | [eliminartercerocliente](https://developer.loggro.com/reference/eliminartercerocliente) 2026-07-29 |
| lectura | GET | `/proveedor/{identificacion}` | Consultar Proveedor | `{identificacion}` |  |  | 200 404 500 |  | [consultarproveedor](https://developer.loggro.com/reference/consultarproveedor) 2026-06-05 |
| escritura | POST | `/proveedor` | Crear Proveedor | body (application/json) |  |  | 201 400 404 500 |  | [crearproveedor](https://developer.loggro.com/reference/crearproveedor) 2026-06-05 |
| escritura | DELETE | `/proveedor/{identificacion}` | Eliminar Proveedor | `{identificacion}` |  |  | 200 404 500 |  | [eliminarproveedor](https://developer.loggro.com/reference/eliminarproveedor) 2026-06-05 |
| lectura | GET | `/tercero/{identificacion}` | Consultar Tercero | `{identificacion}` |  |  | 200 404 500 |  | [consultartercero](https://developer.loggro.com/reference/consultartercero) 2026-06-05 |
| escritura | POST | `/tercero` | Crear Tercero | body (application/json) |  |  | 201 400 404 500 |  | [creartercero](https://developer.loggro.com/reference/creartercero) 2026-06-05 |
| escritura | DELETE | `/tercero/{identificacion}` | Eliminar Tercero | `{identificacion}` |  |  | 200 404 409 500 |  | [eliminartercero](https://developer.loggro.com/reference/eliminartercero) 2026-06-05 |
| lectura | GET | `/conceptoContable/{codigo}` | Consultar Conceptos Contables | `{codigo}` |  |  | 200 404 500 |  | [consultarconceptocontable](https://developer.loggro.com/reference/consultarconceptocontable) 2026-06-05 |
| escritura | POST | `/conceptoContable` | Crear Concepto Contable | body (application/json) |  |  | 201 400 500 |  | [crearconceptocontable](https://developer.loggro.com/reference/crearconceptocontable) 2026-08-05 |
| escritura | DELETE | `/conceptoContable/{codigo}` | Eliminar Concepto Contable | `{codigo}` |  |  | 200 400 404 409 500 |  | [eliminarconceptocontable](https://developer.loggro.com/reference/eliminarconceptocontable) 2026-08-05 |
| lectura | GET | `/cuentaContable/{codigo}` | Consultar Cuentas Contables | `{codigo}` |  |  | 200 404 500 |  | [consultarcuentacontable](https://developer.loggro.com/reference/consultarcuentacontable) 2026-06-05 |
| escritura | POST | `/cuentaContable` | Crear Cuenta Contable | body (application/json) |  |  | 201 400 404 500 |  | [crearcuentacontable](https://developer.loggro.com/reference/crearcuentacontable) 2026-07-14 |
| escritura | DELETE | `/cuentaContable/{codigo}` | Eliminar Cuenta Contable | `{codigo}` |  |  | 200 400 404 409 500 |  | [eliminarcuentacontable](https://developer.loggro.com/reference/eliminarcuentacontable) 2026-07-10 |
| lectura | GET | `/fuenteContable/{codigo}` | Consultar Fuentes Contables | `{codigo}` |  |  | 200 404 500 |  | [consultarfuentecontable](https://developer.loggro.com/reference/consultarfuentecontable) 2026-06-05 |
| escritura | POST | `/fuenteContable` | Crear Fuente Contable | body (application/json) |  |  | 201 400 500 |  | [crearfuentecontable](https://developer.loggro.com/reference/crearfuentecontable) 2026-08-05 |
| escritura | DELETE | `/fuenteContable/{codigo}` | Eliminar Fuente Contable | `{codigo}` |  |  | 200 400 404 409 500 |  | [eliminarfuentecontable](https://developer.loggro.com/reference/eliminarfuentecontable) 2026-08-14 |
| lectura | GET | `/comprobanteContable` | Consultar Comprobante Contable | `comprobante` `fuente` `lote` `periodo` `ano` | `division` |  | 200 400 404 500 |  | [consultarcomprobantecontable](https://developer.loggro.com/reference/consultarcomprobantecontable) 2026-07-07 |
| escritura | POST | `/comprobante` | Crear Comprobante Contable | body (application/json) |  |  | 201 400 404 500 |  | [crearcomprobante](https://developer.loggro.com/reference/crearcomprobante) 2026-09-16 |
| escritura | POST | `/documento_cxc` | Crear Documento CXC | body (application/json) |  |  | 201 400 404 500 |  | [creardocumentocxc](https://developer.loggro.com/reference/creardocumentocxc) 2026-06-05 |
| lectura | GET | `/tipoCliente/{codigo}` | Consultar Tipos de Cliente | `{codigo}` |  |  | 200 404 500 |  | [consultartipocliente](https://developer.loggro.com/reference/consultartipocliente) 2026-08-05 |
| escritura | POST | `/aplicacion_cxp` | Crear Aplicación CXP | body (application/json) |  |  | 201 400 404 500 |  | [crearaplicacion](https://developer.loggro.com/reference/crearaplicacion) 2026-06-05 |
| lectura | GET | `/consultar_documento_cxp/{tipoConsecutivo}/{consecutivo}` | Consultar Documento CXP | `{tipoConsecutivo}` `{consecutivo}` |  |  | 200 404 500 |  | [consultardocumentocxp](https://developer.loggro.com/reference/consultardocumentocxp) 2026-06-05 |
| escritura | POST | `/documento_cxp` | Crear Documento CXP | body (application/json) |  |  | 201 400 404 500 |  | [creardocumentocxp](https://developer.loggro.com/reference/creardocumentocxp) 2026-06-05 |
| lectura | GET | `/tipoProveedor/{codigo}` | Consultar Tipos de Proveedor | `{codigo}` |  |  | 200 404 500 |  | [consultartipoproveedor](https://developer.loggro.com/reference/consultartipoproveedor) 2026-06-05 |
| lectura | GET | `/actividadEconomica/{codigo}` | Consultar Actividad Económica | `{codigo}` |  |  | 200 404 500 |  | [consultaractividadeconomica](https://developer.loggro.com/reference/consultaractividadeconomica) 2026-06-05 |
| lectura | GET | `/caja/{codigo}` | Consultar Caja | `{codigo}` |  |  | 200 404 500 |  | [consultarcaja](https://developer.loggro.com/reference/consultarcaja) 2026-07-16 |
| lectura | GET | `/centroResponsabilidad` | Consultar Centros de Responsabilidad |  | `codigo` |  | 200 400 404 500 |  | [consultarcentroresponsabilidad](https://developer.loggro.com/reference/consultarcentroresponsabilidad) 2026-06-05 |
| lectura | GET | `/ciudad/{codigo}` | Consultar Ciudad | `{codigo}` |  |  | 200 404 500 |  | [consultarciudad](https://developer.loggro.com/reference/consultarciudad) 2026-06-05 |
| lectura | GET | `/conceptoDocumento` | Consultar Conceptos de Documento |  | `conceptoDocumento` |  | 200 400 404 500 |  | [consultarconceptodocumento](https://developer.loggro.com/reference/consultarconceptodocumento) 2026-08-18 |
| lectura | GET | `/cuentaBancaria/{codigo}` | Consultar Cuenta Bancaria | `{codigo}` |  |  | 200 404 500 |  | [consultarcuentabancaria](https://developer.loggro.com/reference/consultarcuentabancaria) 2026-07-16 |
| lectura | GET | `/departamento/{codigo}` | Consultar Departamento | `{codigo}` |  |  | 200 404 500 |  | [consultardepartamento](https://developer.loggro.com/reference/consultardepartamento) 2026-06-05 |
| lectura | GET | `/division` | Consultar División(es) |  | `division` |  | 200 400 404 500 |  | [consultardivision](https://developer.loggro.com/reference/consultardivision) 2026-06-17 |
| lectura | GET | `/formaPago/{codigo}` | Consultar Formas de Pago | `{codigo}` |  |  | 200 404 500 |  | [consultarformapago](https://developer.loggro.com/reference/consultarformapago) 2026-06-05 |
| lectura | GET | `/moneda` | Consultar Moneda(s) |  | `codigo` |  | 200 400 404 500 |  | [consultarmoneda](https://developer.loggro.com/reference/consultarmoneda) 2026-06-05 |
| lectura | GET | `/nivelDivision` | Consultar Niveles de División |  |  |  | 200 400 404 500 |  | [consultarnivelesdivision](https://developer.loggro.com/reference/consultarnivelesdivision) 2026-08-04 |
| lectura | GET | `/pais/{codigo}` | Consultar Pais | `{codigo}` |  |  | 200 404 500 |  | [consultarpaises](https://developer.loggro.com/reference/consultarpaises) 2026-06-05 |
| lectura | GET | `/tipoDocumento` | Consultar Tipo de Documento |  | `codigo` |  | 200 404 500 |  | [consultartipodocumento](https://developer.loggro.com/reference/consultartipodocumento) 2026-07-16 |
| lectura | GET | `/transaccionTesoreria` | Consultar Transacción(es) de Tesorería |  | `codigo` |  | 200 404 500 |  | [consultartransacciontesoreria](https://developer.loggro.com/reference/consultartransacciontesoreria) 2026-08-18 |
| lectura | GET | `/bodega` | Consultar Bodega(s) |  | `bodega` |  | 200 400 404 500 |  | [consultarbodega](https://developer.loggro.com/reference/consultarbodega) 2026-08-03 |
| lectura | GET | `/despacho` | Consultar Despacho | `tipoConsecutivo` `consecutivo` |  |  | 200 400 404 500 |  | [consultardespacho](https://developer.loggro.com/reference/consultardespacho) 2026-08-14 |
| escritura | POST | `/despachos` | Crear Despacho | body (application/json) |  |  | 201 400 404 500 |  | [creardespachoinventario](https://developer.loggro.com/reference/creardespachoinventario) 2026-07-24 |
| escritura | POST | `/entradasCosto` | Crear Entrada de Inventario con Costo | body (application/json) |  |  | 201 400 404 500 |  | [crearentradacostoinventario](https://developer.loggro.com/reference/crearentradacostoinventario) 2026-06-05 |
| escritura | POST | `/entradaDevolucionConsumo` | Crear Entrada por Devolución de Consumo | body (application/json) |  |  | 201 400 404 500 |  | [crearentradadevolucionconsumo](https://developer.loggro.com/reference/crearentradadevolucionconsumo) 2026-09-04 |
| escritura | POST | `/entradaInventario` | Crear Entrada de Inventario | body (application/json) |  |  | 201 400 404 500 |  | [crearentradainventario](https://developer.loggro.com/reference/crearentradainventario) 2026-08-20 |
| lectura | GET | `/item/{codigoItem}` | Consultar Ítem | `{codigoItem}` |  |  | 200 404 500 |  | [consultaritem](https://developer.loggro.com/reference/consultaritem) 2026-08-10 |
| lectura | GET | `/itemControl/{control}` | Consultar Ítems Asociados a un Control | `{control}` |  |  | 200 404 500 |  | [consultaritemcontrol](https://developer.loggro.com/reference/consultaritemcontrol) 2026-06-05 |
| lectura | GET | `/itemsprove` | Consultar Precios de Ítem por Proveedor | `item` | `proveedor` `establecimiento` |  | 200 400 404 500 |  | [consultaritemsprove](https://developer.loggro.com/reference/consultaritemsprove) 2026-07-27 |
| escritura | POST | `/item` | Crear Ítem | body (application/json) |  |  | 201 400 404 500 |  | [crearitem](https://developer.loggro.com/reference/crearitem) 2026-06-05 |
| escritura | DELETE | `/itemControl/{control}` | Eliminar Ítems Asociados a un Control | `{control}` |  |  | 200 404 409 500 |  | [eliminarcontrol](https://developer.loggro.com/reference/eliminarcontrol) 2026-06-05 |
| escritura | DELETE | `/item/{codigoItem}` | Retirar Ítem | `{codigoItem}` |  |  | 200 404 409 500 |  | [eliminaritem](https://developer.loggro.com/reference/eliminaritem) 2026-08-10 |
| lectura | GET | `/itemimptocompra` | Consultar Impuestos de Compra de Ítem | `item` |  |  | 200 400 404 500 |  | [consultaritemimptocompra](https://developer.loggro.com/reference/consultaritemimptocompra) 2026-08-28 |
| lectura | GET | `/lote/{codigoLote}` | Consultar Lotes | `{codigoLote}` |  |  | 200 404 500 |  | [consultarlote](https://developer.loggro.com/reference/consultarlote) 2026-06-05 |
| escritura | POST | `/Lotes` | Crear Lotes | body (application/json) |  |  | 201 400 404 500 |  | [crearlotes](https://developer.loggro.com/reference/crearlotes) 2026-06-05 |
| lectura | GET | `/ordenCompra/{tipoConsecutivo}/{consecutivo}` | Consultar Orden de Compra | `{tipoConsecutivo}` `{consecutivo}` |  |  | 200 400 404 500 |  | [consultarordencompra](https://developer.loggro.com/reference/consultarordencompra) 2026-07-02 |
| escritura | POST | `/ordenCompra` | Crear Orden de Compra | body (application/json) |  |  | 201 400 404 500 |  | [crearordencompra](https://developer.loggro.com/reference/crearordencompra) 2026-06-05 |
| lectura | GET | `/pedido/{idPedido}` | Consultar Pedido por Código | `{idPedido}` |  |  | 200 404 500 |  | [consultarpedido](https://developer.loggro.com/reference/consultarpedido) 2026-06-05 |
| lectura | GET | `/pedidoControl/{idPedido}` | Consultar Pedido por Control | `{idPedido}` |  |  | 200 404 500 |  | [consultarpedidocontrol](https://developer.loggro.com/reference/consultarpedidocontrol) 2026-06-05 |
| escritura | POST | `/pedidos` | Crear Pedido | body (application/json) |  |  | 201 400 404 500 |  | [crearpedido](https://developer.loggro.com/reference/crearpedido) 2026-06-05 |
| lectura | GET | `/requisicion/{tipoConsecutivo}/{consecutivo}` | Consultar Requisición | `{tipoConsecutivo}` `{consecutivo}` |  |  | 200 400 404 500 |  | [consultarrequisicion](https://developer.loggro.com/reference/consultarrequisicion) 2026-08-12 |
| escritura | POST | `/requisicion` | Crear Requisición | body (application/json) |  |  | 201 400 500 |  | [crearrequisicion](https://developer.loggro.com/reference/crearrequisicion) 2026-07-15 |
| lectura | GET | `/rolUsuario` | Consultar Roles de Usuario por Filtro |  | `rol` `bodega` |  | 200 400 404 500 |  | [consultarrolesporfiltro](https://developer.loggro.com/reference/consultarrolesporfiltro) 2026-06-09 |
| lectura | GET | `/rolUsuario/{usuario}` | Consultar Roles de Usuario por Código de Usuario | `{usuario}` | `rol` `bodega` |  | 200 404 500 |  | [consultarrolesusuario](https://developer.loggro.com/reference/consultarrolesusuario) 2026-06-09 |
| escritura | POST | `/salidasInventario` | Crear Salida de Inventario | body (application/json) |  |  | 201 400 404 500 |  | [crearsalidainventario](https://developer.loggro.com/reference/crearsalidainventario) 2026-06-05 |
| lectura | GET | `/tipoItem/{codigoTipoItem}` | Consultar Tipo(s) de Ítem | `{codigoTipoItem}` |  |  | 200 404 500 |  | [consultartipositem](https://developer.loggro.com/reference/consultartipositem) 2026-09-16 |
| escritura | POST | `/entradasOC` | Crear Entrada de Inventario por Orden de Compra | body (application/json) |  |  | 201 400 404 500 |  | [crearentradaoc](https://developer.loggro.com/reference/crearentradaoc) 2026-06-10 |
| lectura | GET | `/obtenerDocumentosFERango/{fecha}/{hora}` | Obtener Documentos Electrónicos por Rango de Fecha | `{fecha}` `{hora}` |  |  | 200 404 500 |  | [documentosexternosfe](https://developer.loggro.com/reference/documentosexternosfe) 2026-06-05 |
| escritura | POST | `/ingreso` | Crear Ingreso | body (application/json) |  |  | 201 400 404 500 |  | [crearingresos](https://developer.loggro.com/reference/crearingresos) 2026-06-05 |
