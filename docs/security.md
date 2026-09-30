# Seguridad y privacidad — diseño

> Este documento describe el **diseño** de seguridad. Para reportar una vulnerabilidad, ver
> [`../SECURITY.md`](../SECURITY.md).

## 1. Qué se protege

| Activo | Por qué importa |
| --- | --- |
| Credenciales de Loggro (correo y contraseña de Restobar, tokens de otros productos) | Dan acceso a la operación del negocio. En Restobar, con los permisos del rol del usuario. En Nómina, siempre con permisos de **administrador** (✅ documentado). |
| Token de sesión (`tokenCurrent`) | Equivale a la credencial mientras sea válido. |
| Datos personales de terceros | Clientes y proveedores: documento de identidad, correo, teléfono, dirección, fecha de nacimiento. |
| Datos financieros del negocio | Ventas, facturas, gastos, utilidad, medios de pago, cuadres de caja. |
| Integridad de los datos en Loggro | Un error o un abuso no debe poder modificar nada. |

## 2. Modelo de amenazas

| # | Amenaza | Mitigación |
| --- | --- | --- |
| A1 | Secretos en Git (un `.env` subido, logs o fixtures reales) | `.gitignore` bloquea `.env*` salvo `.env.example`; fixtures solo sintéticos; plantilla de issues que pide no pegar datos reales; se recomienda activar _secret scanning_ y _push protection_ de GitHub. |
| A2 | Secretos en logs o en errores | El logger redacta cabeceras, tokens y cuerpos de login; los errores hacia el modelo no incluyen cabeceras ni respuestas crudas; pruebas unitarias de redacción. |
| A3 | Secretos expuestos al modelo | Las credenciales nunca son argumentos ni salida de herramientas; la respuesta de `/login` no se devuelve; campos como `password` de mesas se eliminan. |
| A4 | Escritura accidental | Allowlist de operaciones de lectura, sin método genérico de solicitud, verificación en el transporte y anotaciones `readOnlyHint` (ver `architecture.md` §6). |
| A5 | **Prompt injection** desde datos de Loggro | Nombres, notas y descripciones son texto libre escrito por terceros y pueden contener instrucciones. Se devuelven como **datos** estructurados (JSON), nunca como instrucciones. Las descripciones de herramientas avisan que el contenido es externo. Como no hay herramientas de escritura ni de red arbitraria (p. ej. no se sigue `urlImage`), el daño posible queda acotado. |
| A6 | Exfiltración mediante otras herramientas del cliente | Un modelo con acceso simultáneo a Loggro y a herramientas que envían datos (correo, web) podría filtrar información si recibe instrucciones maliciosas. Mitigación: documentarlo y recomendar al usuario no combinar MCP_Loggro con herramientas de envío sin confirmación humana. Queda fuera del control de este servidor. |
| A7 | Sobreexposición de datos | Salidas con campos explícitos (no se reenvía el objeto completo de la API); datos personales excluidos o enmascarados por defecto; tamaño de página propio y máximo de caracteres por respuesta. |
| A8 | Consumo excesivo de la API | Límite de tamaño de página propio, pocas solicitudes concurrentes, reintentos acotados con backoff y timeouts. |
| A9 | Cadena de suministro | Dependencias mínimas y justificadas ([`decisions.md`](./decisions.md)); `package-lock.json` versionado; `npm ci` en CI; Dependabot; Actions fijadas por SHA. |
| A10 | Suplantación de la API | Solo HTTPS hacia URL base oficial fija; la URL base configurable debe usar `https://` (validado al arrancar). |
| A11 | Cierre de sesión del usuario humano o de sus automatizaciones | ❓ No se sabe si un login nuevo invalida otros tokens de Restobar. Se recomienda un **usuario dedicado**; si no es posible, usar el modo token (ADR-014) y hacer como máximo un login por sesión del servidor. |
| A12 | Archivos exportados | Contienen datos personales y financieros. Se escriben con permisos solo para el usuario, en una carpeta configurable, sin sobrescribir y con nombre generado por el servidor (sin rutas controladas por el modelo). |
| A13 | Inyección de fórmulas en Excel/CSV (CWE-1236) | Un nombre o nota de cliente como `=HYPERLINK(...)` podría ejecutarse al abrir el archivo. Toda celda de texto que empiece con `=`, `+`, `-` o `@` se neutraliza. |

## 3. Credenciales

1. **Usuario dedicado (recomendado).** Crear en Restobar un usuario exclusivo para el MCP, con un rol
   que tenga solo los permisos de consulta necesarios. Restobar exige permisos de _creación/edición_ para
   algunas consultas por ID (p. ej. `GET /clients/{id}` → `CL_POST`); las herramientas deben preferir las
   consultas por listado para no obligar a conceder esos permisos.
   **Si se usa el usuario principal** (caso del propietario del proyecto, en producción), ese usuario
   probablemente tenga permisos de escritura. Entonces la garantía de solo lectura depende **por completo**
   del código de MCP_Loggro. Por eso:
   - el transporte HTTP solo permite `GET` a rutas de la allowlist, más `POST /login`, y esto tiene pruebas
     que fallan si alguien añade otro método o una ruta no clasificada como `lectura`;
   - no existe ninguna herramienta ni función interna que acepte un método o una ruta arbitrarios;
   - las pruebas contra producción solo ejecutan herramientas de lectura y no imprimen datos.
2. **Variables de entorno.** Las credenciales se leen del entorno del proceso. El cliente MCP (p. ej.
   Claude Desktop) las define en su configuración, que suele guardarse **en texto plano** en el perfil del
   usuario. El usuario debe proteger ese archivo y no compartirlo.
3. **Desarrollo local.** Para pruebas se usa `.env` (ignorado por Git) cargado con la opción nativa de Node
   `--env-file`; no hace falta la dependencia `dotenv`.
4. **Almacenamiento del token.** Solo en memoria del proceso. No hay caché en disco.
5. **Rotación.** Si una credencial se expone: cambiar la contraseña del usuario en Restobar (o regenerar
   el token en otros productos) y revisar la actividad en Loggro.

## 4. Privacidad y datos

### Qué datos pueden pasar de Loggro al modelo

| Categoría | Ejemplos (Restobar, según esquemas oficiales) | Tratamiento por defecto propuesto |
| --- | --- | --- |
| Identificación de personas | `name`, `lastName` de clientes y proveedores | Incluidos. |
| Datos personales de contacto e identidad | `document`, `idDocumentType`, `email`, `phone`, `address`, `birthdate` | **Incluidos** (ADR-011). Se ocultan con `LOGGRO_REDACT_PERSONAL_DATA=true`. |
| Datos financieros de clientes | `points`, `creditMovement` (movimientos de crédito) | Incluidos solo en las herramientas que los necesiten. |
| Datos financieros del negocio | totales, impuestos, medios de pago, gastos, utilidad | Incluidos: son el propósito de la herramienta. |
| Secretos operativos | `password` de mesas, `tokenCurrent`, `lastTokenDevice` | **Siempre eliminados.** |

Las herramientas de exportación (ADR-015) escriben los datos en un archivo local y **no** los envían al
modelo: solo devuelven la ruta y el número de filas. Es la vía recomendada para listados grandes con datos
personales.

### Riesgos y responsabilidades

- Todo dato que el servidor devuelve **se envía al proveedor del modelo** que usa el cliente MCP (p. ej.
  Anthropic en Claude). Quien instala MCP_Loggro decide si eso es aceptable según sus políticas internas,
  sus contratos y la normativa que le aplique (en Colombia, el régimen de protección de datos personales
  de la Ley 1581 de 2012 y sus normas reglamentarias). Este proyecto **no afirma** cumplimiento legal específico.
- El usuario es responsable de las credenciales que configura y de quién tiene acceso al cliente MCP.
- Se recomienda usar primero una cuenta o negocio de prueba.

## 5. Modo remoto (librería)

Cuando una plataforma monta las herramientas en su propio servidor (ADR-018,
[`remote-integration.md`](./remote-integration.md)), la seguridad de las credenciales pasa a ser suya:

- **Autenticación:** cada petición MCP debe traer un access token OAuth válido; el usuario se deduce del
  token, nunca de los argumentos.
- **Aislamiento entre cuentas:** cada conexión usa solo la credencial de la cuenta del usuario
  autenticado. Las herramientas no tienen ningún parámetro para elegir otra cuenta.
- **Token de Restobar:** lo entrega el `TokenProvider` de la plataforma y solo viaja en la cabecera
  hacia `api.pirpos.com`; las herramientas nunca lo devuelven ni lo registran.
- **Sin archivos en el servidor:** con `exportDir: null` no se registra la exportación a Excel.

## 6. Reglas para contribuciones

- No incluir credenciales, tokens, NIT, documentos, correos ni teléfonos reales en código, pruebas,
  issues ni PRs.
- Toda herramienta nueva debe declarar su operación en la allowlist con enlace a la página oficial y
  pasar la prueba de contrato.
- Toda salida nueva debe pasar por el saneamiento y declarar un `outputSchema` explícito.
