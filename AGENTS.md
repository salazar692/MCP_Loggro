# Guía para agentes de IA

Servidor MCP de **solo lectura** para Loggro Restobar (`https://api.pirpos.com`), en TypeScript.

- **Datos de la API:** antes de tocar esquemas o herramientas, lee
  [`docs/restobar-data-map.md`](docs/restobar-data-map.md). Explica cómo llega cada campo en la API
  real y cómo se mapea. La documentación oficial no trae esquemas de respuesta y varios campos
  difieren de lo esperado.
- **Esquemas:** `src/loggro/restobar/schemas.ts`. **Herramientas:** `src/tools/restobar/`.
- **Verificar:** `npm run check` (formato, lint, tipos, pruebas y build).
- **Pruebas contra la API real:** `scripts/smoke-restobar.ts`. En Claude Code en la nube hace falta
  `NODE_USE_ENV_PROXY=1`. Solo lectura, nunca `POST /login`, con tope de solicitudes por
  herramienta. Nunca imprimas, guardes ni subas datos personales, montos ni el token.
- **Decisiones y preguntas abiertas:** [`docs/decisions.md`](docs/decisions.md) y
  [`docs/open-questions.md`](docs/open-questions.md).
