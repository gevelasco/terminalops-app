# TerminalOps (Angular)

Aplicación web de gestión logística con Angular 19. Consume **`terminalops-api`** (NestJS + PostgreSQL) vía HTTP con JWT.

## Requisitos

- Node.js 20+
- API en ejecución: ver [`../terminalops-api/README.md`](../terminalops-api/README.md)

## Desarrollo

```bash
npm install
npm run dev
```

Abre http://localhost:4200 — login contra la API (`gvelasco` / `Admin123` con seed de desarrollo).

## Estructura

| Ruta | Contenido |
|------|-----------|
| `src/app/core/` | Layout, sesión JWT, interceptores, guards |
| `src/app/shared/` | Modelos, catálogos de formulario, UI `to-*` |
| `src/app/core/services/api/` | Servicios HTTP (`ClientsService`, `TripsService`, …) estilo fintrack |
| `src/app/features/*` | Dominios (UI, rutas, utilidades); sin capa `data/` de repositorios |
| `src/environments/` | `apiUrl` por entorno |

## Datos

- **Backend:** esquema SQL, migraciones y seed en `terminalops-api/db/`.
- **Frontend:** solo catálogos estáticos de UI (`shared/catalogs/`) y preferencias locales temporales hasta endpoints de usuario en la API.

## Scripts

| Script | Uso |
|--------|-----|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Sirve `dist/` (producción) |

## Alias TypeScript

`@app/*`, `@core/*`, `@shared/*`, `@features/*` en `tsconfig.json`.
