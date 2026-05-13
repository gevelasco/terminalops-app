# TerminalOps (Angular)

Aplicación web de gestión logística con Angular 19 (standalone), routing por features con lazy loading, UI compartida con prefijo `to-`, y datos mock intercambiables por API HTTP.

## Capas

- **`src/app/core/`** — Layout (`ShellComponent`), sesión (`SessionStore`), interceptores HTTP (`auth`, `error`), guard (`authGuard`), servicios globales (`ThemeService`, `AuthFacade`).
- **`src/app/shared/`** — Modelos de dominio (`shared/models`), pipes (`currencyMx`, `dateShort`), utilidades y componentes UI genéricos (`shared/ui`, selectores `to-*`).
- **`src/app/features/*`** — Un directorio por dominio (`dashboard`, `maniobra`, `fleet`, `operators`, `expenses`, `reports`). Cada uno expone `routes.ts` y usa repositorios abstractos en `data/` con implementación mock.
- **`src/app/mock-data/`** — Constantes de ejemplo consumidas por los mocks.
- **`src/environments/`** — `environment.ts` (producción) y `environment.development.ts` (reemplazo en build `development` vía `angular.json`).

## Sustituir mocks por API real

1. Implementa clases **Http\*** que extiendan los mismos abstractos (`ManiobraRepository`, `AlertRepository`, etc.) usando `HttpClient` y las URLs de `environment.apiUrl`.
2. En `app.config.ts`, cambia los `useClass` de cada `provide` de repositorio de `Mock*` a la implementación HTTP (o usa `environment.production` para alternar).
3. Los interceptores ya añaden `Authorization` desde `SessionStore` cuando exista token; ajusta reglas y manejo de 401 en `error.interceptor.ts`.

## Alias de rutas TypeScript

`@app/*`, `@core/*`, `@shared/*`, `@features/*` están definidos en `tsconfig.json`.

## Desarrollo

```bash
npm start
```

Abre `http://localhost:4200/`; la ruta vacía redirige a `/dashboard`. En desarrollo, `authDevBypass` permite navegar sin login; con producción sin bypass, el guard redirige a `/login`.
