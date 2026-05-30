# Reglas de distancia — Trips / Fleet / Fuel

**Fuente de verdad: backend** (`trip-operational-distance.util.ts`).

| Concepto | Campo | Uso |
| -------- | ----- | --- |
| Ruta OSRM (solo ida) | `routeDistanceKm` | UI «Distancia de ruta (ida)», Local/Foránea |
| Operación logística | `operationalDistanceKm` | Diesel, desgaste, reportes, costos |
| Ida + vuelta | `isRoundTrip` (default `true` en API) | Explícito en payloads; no asumir solo en UI |

## Prohibido en frontend

- `routeDistanceKm * 2` o cualquier `× 2` para simular vuelta
- Usar `trip.routeDistanceKm` en sumas de reportes o fleet stats
- Tratar OSRM (`routeKm` / `routeDistanceKm`) como distancia operativa

## Obligatorio en frontend

- Métricas: `tripOperationalKm(trip)` → solo `trip.operationalDistanceKm`
- Fuel / crear maniobra: enviar `isRoundTrip: true` explícitamente
- UI operativa: consumir `operationalDistanceKm` del API (p. ej. fuel-estimate)

## Control automático de diesel (`dieselControlEnabled`)

Configuración de empresa en sesión. Default: activado.

| Caso | Comportamiento |
| ---- | -------------- |
| Nueva maniobra + control **activo** | Pipeline fuel-estimate (effect con cleanup) |
| Nueva maniobra + control **inactivo** | Sin pipeline, sin debounce, sin requests; captura manual |
| Ver maniobra existente | Mostrar `dieselLiters`, `dieselAmount`, `dieselPricePerLiterAtCreation` (snapshot) |
| Recalcular diesel en histórico | **No** — no hay fuel-estimate en detalle/edición |
| Editar costos históricos | Solo vía gastos/API de update cuando exista; valores guardados prevalecen |

El pipeline de estimación **no se crea** si `dieselControlEnabled === false` (`effect` + `onCleanup` en `trips-new-drawer`).

## Verificación

```bash
npm run check:trip-distance
```
