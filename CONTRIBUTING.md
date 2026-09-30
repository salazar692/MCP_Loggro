# Cómo contribuir a MCP_Loggro

¡Gracias por tu interés! Este proyecto sigue tres reglas no negociables:

1. **No inventar.** Todo endpoint, parámetro o campo de Loggro debe estar en la documentación oficial
   (<https://developer.loggro.com>) y en el inventario generado
   ([`docs/loggro-api/inventory/`](docs/loggro-api/inventory/README.md)). Lo que no esté documentado se
   registra en [`docs/open-questions.md`](docs/open-questions.md), no se asume.
2. **Solo lectura.** No se aceptan herramientas que creen, modifiquen, eliminen o anulen datos, ni
   endpoints clasificados distinto de `lectura` en el inventario.
3. **Cero secretos y cero datos reales.** Nada de credenciales, tokens, NIT, documentos, correos ni
   teléfonos reales en código, pruebas, issues o PRs.

## Entorno de desarrollo

Requisitos: Node.js ≥ 22.18 y npm.

```bash
git clone https://github.com/salazar692/MCP_Loggro_Restobar.git
cd MCP_Loggro
npm ci
npm run check   # formato, lint, tipos, pruebas y build; lo mismo que la CI
```

| Comando | Qué hace |
| --- | --- |
| `npm run format` | Aplica Prettier (código, JSON y YAML; Markdown se edita a mano). |
| `npm run lint` | ESLint con reglas que usan información de tipos. |
| `npm run typecheck` | `tsc` sin emitir. |
| `npm test` / `npm run test:watch` | Pruebas con Vitest (sin red). |
| `npm run build` | Compila `src/` a `dist/`. |
| `npm run docs:sync` | Descarga la documentación oficial y regenera el inventario (`-- --offline` usa la caché). |

Para probar con credenciales propias en local, copia `.env.example` a `.env` (ignorado por Git) y usa
la opción nativa de Node `--env-file=.env`.

## Proponer una herramienta nueva

Sigue [`docs/tool-design.md` §6](docs/tool-design.md#6-cómo-proponer-una-herramienta-nueva). En resumen:
abre un issue «Solicitud de herramienta» con el enlace oficial del endpoint y la pregunta de usuario que
resuelve, antes de escribir código.

## Actualizar el inventario de la API

Loggro actualiza su documentación. Ejecuta `npm run docs:sync` y abre un PR con el diff de
`docs/loggro-api/inventory/`. Si cambia la clase de una operación, o aparece un GET con efectos
secundarios, actualiza las reglas en `scripts/lib/loggro-docs.ts` y sus pruebas.

## Pull requests

- Un PR = un cambio coherente. Explica el **porqué** y enlaza la documentación oficial que lo respalda.
- `npm run check` debe pasar.
- Toda dependencia nueva requiere justificación en [`docs/decisions.md`](docs/decisions.md).
- Los cambios de arquitectura o seguridad se discuten primero en un issue.

## Reportar errores

Usa la plantilla de issue. **Elimina tokens, contraseñas y datos de clientes** de logs y capturas.
Las vulnerabilidades se reportan en privado: ver [`SECURITY.md`](SECURITY.md).
