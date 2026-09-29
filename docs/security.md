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
| A11 | Cierre de sesión del usuario humano | ❓ No se sabe si un login nuevo invalida otros tokens de Restobar. Por eso se recomienda un **usuario dedicado** para el MCP. |

## 3. Credenciales

1. **Usuario dedicado.** Crear en Restobar un usuario exclusivo para el MCP, con un rol que tenga solo
   los permisos de consulta necesarios. Restobar exige permisos de _creación/edición_ para algunas
   consultas por ID (p. ej. `GET /clients/{id}` → `CL_POST`); las herramientas deben preferir las
   consultas por listado para no obligar a conceder esos permisos.
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
| Identificación de personas | `name`, `lastName` de clientes y proveedores | Se incluyen: son necesarios para consultas como «facturas del cliente X». |
| Datos personales de contacto e identidad | `document`, `idDocumentType`, `email`, `phone`, `address`, `birthdate` | **Excluidos o enmascarados** salvo activación explícita (pendiente de decisión del propietario). |
| Datos financieros del negocio | totales, impuestos, medios de pago, gastos, utilidad | Se incluyen: son el propósito de la herramienta. |
| Secretos operativos | `password` de mesas, `tokenCurrent`, `lastTokenDevice` | **Siempre eliminados.** |

### Riesgos y responsabilidades

- Todo dato que el servidor devuelve **se envía al proveedor del modelo** que usa el cliente MCP (p. ej.
  Anthropic en Claude). Quien instala MCP_Loggro decide si eso es aceptable según sus políticas internas,
  sus contratos y la normativa que le aplique (por ejemplo, la de protección de datos personales en
  Colombia). Este proyecto **no afirma** cumplimiento legal específico.
- El usuario es responsable de las credenciales que configura y de quién tiene acceso al cliente MCP.
- Se recomienda usar primero una cuenta o negocio de prueba.

## 5. Reglas para contribuciones

- No incluir credenciales, tokens, NIT, documentos, correos ni teléfonos reales en código, pruebas,
  issues ni PRs.
- Toda herramienta nueva debe declarar su operación en la allowlist con enlace a la página oficial y
  pasar la prueba de contrato.
- Toda salida nueva debe pasar por el saneamiento y declarar un `outputSchema` explícito.
