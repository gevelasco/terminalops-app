import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/** Soft delete lógico: recurso visible y asignable en operación. */
export const FLEET_RESOURCE_VISIBILITY_OPTIONS: ToSelectOption[] = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
];

/** Estado operativo de unidad o equipo (alta / edición en Flota). */
export const FLEET_UNIT_STATUS_OPTIONS: ToSelectOption[] = [
  { value: 'available', label: 'Disponible' },
  { value: 'in_use', label: 'En uso' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'maintenance', label: 'Mantenimiento' },
];

/** Modo de tenencia del remolque (propiedad / arrendamiento). */
export const FLEET_TRAILER_TENURE_OPTIONS: ToSelectOption[] = [
  { value: 'owned', label: 'Propio' },
  { value: 'financed', label: 'Financiado' },
  { value: 'leased', label: 'Arrendado' },
  { value: 'managed', label: 'Administrado' },
];

/** Cadencia de pago (seguro, GPS, rentas). */
export const FLEET_PAYMENT_CADENCE_OPTIONS: ToSelectOption[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'annual', label: 'Anual' },
];

/** Tipos de mantenimiento (historial y alta). */
export const FLEET_MAINTENANCE_TYPE_OPTIONS: ToSelectOption[] = [
  { value: 'servicio_completo', label: 'Servicio completo' },
  { value: 'medio_servicio', label: 'Medio servicio' },
  { value: 'mecanica_general', label: 'Mecánica general' },
  { value: 'reparacion_electrica', label: 'Reparación eléctrica' },
  { value: 'accesorios', label: 'Accesorios' },
  { value: 'cambio_llantas', label: 'Cambio de llantas' },
  { value: 'otro', label: 'Otro' },
];

/** Cómo programar el siguiente mantenimiento al registrar uno nuevo. */
export const FLEET_MAINT_SCHEDULE_NEXT_MODE_OPTIONS: ToSelectOption[] = [
  { value: 'tiempo', label: 'Por tiempo (calendario)' },
  { value: 'km', label: 'Por kilómetros' },
];

/** Condición de banda de rodado (ficha técnica). */
export const FLEET_TIRE_CONDITION_OPTIONS: ToSelectOption[] = [
  {
    value: 'excellent',
    label: 'Excelente (banda ≥ 6 mm, sin daños)',
  },
  { value: 'good', label: 'Buena (4–6 mm, uso normal)' },
  { value: 'fair', label: 'Regular (2–4 mm, planear cambio)' },
  { value: 'low', label: 'Baja (cerca del mínimo legal)' },
  { value: 'critical', label: 'Crítica (fuera de servicio / cambio inmediato)' },
];

/**
 * Modalidad de autotransporte federal de carga (México, RDAFYSA arts. 39–41).
 * Carga general vs. subtipos de carga especializada.
 */
export const FLEET_SERVICE_MODALITY_OPTIONS: ToSelectOption[] = [
  { value: 'carga_general', label: 'Carga general' },
  { value: 'materiales_peligrosos', label: 'Materiales y residuos peligrosos' },
  { value: 'voluminosos_gran_peso', label: 'Objetos voluminosos o de gran peso' },
  { value: 'fondos_valores', label: 'Fondos y valores' },
];

/** Tipo de transmisión (unidad tractora). */
export const FLEET_TRANSMISSION_TYPE_OPTIONS: ToSelectOption[] = [
  { value: 'automatic', label: 'Automática' },
  { value: 'standard', label: 'Estándar (manual)' },
  { value: 'semi', label: 'Semiautomática (AMT)' },
];

/** Número de velocidades (unidad tractora). */
export const FLEET_TRANSMISSION_SPEED_OPTIONS: ToSelectOption[] = [
  { value: '6', label: '6 velocidades' },
  { value: '7', label: '7 velocidades' },
  { value: '8', label: '8 velocidades' },
  { value: '9', label: '9 velocidades' },
  { value: '10', label: '10 velocidades' },
  { value: '12', label: '12 velocidades' },
  { value: '13', label: '13 velocidades' },
  { value: '14', label: '14 velocidades' },
  { value: '18', label: '18 velocidades' },
];

/** Años modelo para selects (descendente).
 * Por defecto desde año actual + 1 hasta 1990 (mismo criterio que drawers de Flota).
 */
export function buildFleetModelYearSelectOptions(
  params: { minYear?: number; maxYearInclusive?: number } = {},
): ToSelectOption[] {
  const minYear = params.minYear ?? 1990;
  const maxYearInclusive = params.maxYearInclusive ?? new Date().getFullYear() + 1;
  const out: ToSelectOption[] = [];
  for (let i = maxYearInclusive; i >= minYear; i--) {
    out.push({ value: String(i), label: String(i) });
  }
  return out;
}

/** Tipo de unidad / caja (operación México): portacontenedor, plataforma, etc. */
export const EQUIPMENT_OPERATION_TYPE_OPTIONS: ToSelectOption[] = [
  { value: 'portacontenedor', label: 'Portacontenedor / chasis' },
  { value: 'plataforma', label: 'Plataforma (flatbed)' },
  { value: 'caja_seca', label: 'Caja seca (dry van)' },
  { value: 'refrigerado', label: 'Refrigerado (reefer)' },
  { value: 'gondola', label: 'Góndola / baranda baja' },
  { value: 'cama_baja', label: 'Cama baja (lowboy)' },
  { value: 'cuello_ganso', label: 'Cuello de ganso' },
  { value: 'colectora', label: 'Colectora / plataforma extensible' },
  { value: 'tolva', label: 'Tolva' },
  { value: 'pipa', label: 'Pipa (tanque)' },
  { value: 'cortina', label: 'Lona / cortina lateral' },
  { value: 'modular', label: 'Modular / plataforma step-deck' },
  { value: 'otro', label: 'Otro' },
];

/** Configuración de vanos ISO, chasis o longitud en pies según tipo de equipo. */
export const EQUIPMENT_CONTAINER_SLOT_OPTIONS: ToSelectOption[] = [
  { value: 'na', label: 'No aplica' },
  { value: 'iso_20', label: "20′ (un contenedor)" },
  { value: 'iso_40', label: "40′ (un contenedor)" },
  { value: 'iso_45', label: "45′ (un contenedor)" },
  { value: 'iso_20_20', label: "20′ + 20′ (dos contenedores)" },
  { value: 'iso_20_40', label: "20′ ó 40′ (extensible)" },
  { value: 'iso_20_45', label: "20′ a 45′ (extensible)" },
  { value: 'iso_20_40_45', label: "20′ / 40′ / 45′ (extensible)" },
  { value: 'gooseneck', label: 'Cuello de ganso (high cube)' },
  { value: 'fixed', label: 'Chasis fijo' },
  { value: 'ft_53', label: '53 pies' },
  { value: 'ft_48', label: '48 pies' },
  { value: 'ft_46', label: '46 pies' },
  { value: 'ft_42', label: '42 pies' },
  { value: 'ft_40', label: '40 pies' },
];
