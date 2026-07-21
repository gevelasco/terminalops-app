# Reglas de distancia — Trips / Fleet / Fuel

**Contrato post-cleanup:** el API ya no persiste `operationalDistanceKm` ni `isRoundTrip`.
Siempre roundtrip: **km operativos = `routeDistanceKm × 2`**.

| Concepto | Campo / cálculo | Uso |
| -------- | --------------- | --- |
| Ruta OSRM (solo ida) | `routeDistanceKm` | UI «Distancia de ruta (ida)», Local/Foránea, create payload |
| Operación logística | `tripOperationalKm(trip)` → `route × 2` | Diesel, desgaste, reportes, costos |
| Ida + vuelta | implícito (siempre) | No enviar `isRoundTrip` en create / fuel-estimate |

## Prohibido en frontend

- Persistir o mapear `operationalDistanceKm` / `isRoundTrip` desde el trip
- Enviar `isRoundTrip`, `dieselPricePerLiterAtCreation`, toll mode o snapshots en create
- Usar `trip.origin` / `trip.destination` como fuente primaria de labels (preferir partes postales)

## Obligatorio en frontend

- Métricas: `tripOperationalKm(trip)` → `routeDistanceKm × 2`
- Create: partes postales + `routeDistanceKm` + `casetasAmount` + diesel liters/amount + `operationConfigurationId`
- Precio diesel en detalle: `derivedDieselPricePerLiter` (amount / liters)
- Fuel-estimate: enviar `distanceKm` (ida); el backend aplica roundtrip

## Control automático de diesel (`dieselControlEnabled`)

Configuración de empresa en sesión. Default: activado.

| Caso | Comportamiento |
| ---- | -------------- |
| Nueva maniobra + control **activo** | Pipeline fuel-estimate (effect con cleanup) |
| Nueva maniobra + control **inactivo** | Sin pipeline; captura manual |
| Ver maniobra existente | Mostrar `dieselLiters`, `dieselAmount`; precio = amount/liters |
| Recalcular diesel en histórico | **No** |

## Verificación

```bash
npm run check:trip-distance
```
