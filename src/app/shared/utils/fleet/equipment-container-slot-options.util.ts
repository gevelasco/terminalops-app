import {
  EQUIPMENT_CONTAINER_SLOT_OPTIONS,
  EQUIPMENT_OPERATION_TYPE_OPTIONS,
} from '@shared/catalogs/fleet-form-options';
import type { EquipmentContainerSlotConfigKey } from '@shared/models/logistics.models';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

function valueFromLabel(opts: ToSelectOption[], label: string | undefined): string {
  if (!label) {
    return '';
  }
  const normalized = label.trim().toLowerCase();
  return opts.find((option) => option.label.trim().toLowerCase() === normalized)?.value ?? '';
}

/** Etiquetas legibles de `fixed` en datos históricos. */
const LEGACY_FIXED_SLOT_LABELS = new Set([
  'chasis fijo / cerrado',
  'chasis fijo',
]);

/**
 * Opciones de configuración por tipo de equipo (México / NAM).
 *
 * - Portacontenedor: plazas ISO / chasis fijos, extensibles (extraíbles),
 *   combinados (uno u otro tamaño) y cuello de ganso para high cube.
 * - Cajas cerradas (seca, reefer, cortina): longitud en pies (48′ / 53′).
 * - Plataformas y similares: longitud de deck en pies.
 * - Góndola, tolva, pipa, cuello de ganso: no aplica configuración de vano.
 */
export const EQUIPMENT_CONTAINER_SLOT_KEYS_BY_OPERATION_TYPE: Readonly<
  Record<string, readonly EquipmentContainerSlotConfigKey[]>
> = {
  portacontenedor: [
    'iso_20',
    'iso_40',
    'iso_45',
    'iso_20_20',
    'iso_20_40',
    'iso_20_45',
    'iso_20_40_45',
    'gooseneck',
    'fixed',
  ],
  plataforma: ['ft_40', 'ft_42', 'ft_46', 'ft_48', 'ft_53'],
  caja_seca: ['ft_48', 'ft_53'],
  refrigerado: ['ft_48', 'ft_53'],
  cortina: ['ft_48', 'ft_53'],
  modular: ['ft_40', 'ft_48'],
  colectora: ['ft_40', 'ft_48', 'ft_53'],
  cama_baja: ['ft_40', 'ft_48', 'ft_53'],
  gondola: ['na'],
  tolva: ['na'],
  pipa: ['na'],
  cuello_ganso: ['na'],
  otro: [
    'na',
    'iso_20',
    'iso_40',
    'iso_45',
    'iso_20_20',
    'iso_20_40',
    'iso_20_45',
    'iso_20_40_45',
    'gooseneck',
    'fixed',
    'ft_40',
    'ft_42',
    'ft_46',
    'ft_48',
    'ft_53',
  ],
};

/** Orden canónico en listas desplegables (ISO por tamaño, luego pies). */
const CONTAINER_SLOT_DISPLAY_ORDER: readonly EquipmentContainerSlotConfigKey[] = [
  'na',
  'iso_20',
  'iso_40',
  'iso_45',
  'iso_20_20',
  'iso_20_40',
  'iso_20_45',
  'iso_20_40_45',
  'gooseneck',
  'fixed',
  'ft_40',
  'ft_42',
  'ft_46',
  'ft_48',
  'ft_53',
];

const CONTAINER_SLOT_ORDER_INDEX = new Map(
  CONTAINER_SLOT_DISPLAY_ORDER.map((key, index) => [key, index] as const),
);

function sortContainerSlotKeys(
  keys: readonly EquipmentContainerSlotConfigKey[],
): EquipmentContainerSlotConfigKey[] {
  return [...keys].sort(
    (left, right) =>
      (CONTAINER_SLOT_ORDER_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (CONTAINER_SLOT_ORDER_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

const SLOT_OPTION_BY_KEY = new Map(
  EQUIPMENT_CONTAINER_SLOT_OPTIONS.map((option) => [option.value, option] as const),
);

export function resolveEquipmentOperationTypeCode(
  rawType: string | undefined | null,
): string {
  const trimmed = rawType?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (EQUIPMENT_OPERATION_TYPE_OPTIONS.some((option) => option.value === trimmed)) {
    return trimmed;
  }
  return valueFromLabel(EQUIPMENT_OPERATION_TYPE_OPTIONS, trimmed) || trimmed;
}

export function containerSlotKeysForOperationType(
  operationTypeCode: string,
): readonly EquipmentContainerSlotConfigKey[] {
  const code = operationTypeCode.trim();
  if (!code) {
    return ['na'];
  }
  return (
    EQUIPMENT_CONTAINER_SLOT_KEYS_BY_OPERATION_TYPE[code] ??
    EQUIPMENT_CONTAINER_SLOT_KEYS_BY_OPERATION_TYPE['otro']
  );
}

export function containerSlotSelectOptionsForOperationType(
  operationTypeCode: string,
): ToSelectOption[] {
  const keys = sortContainerSlotKeys(containerSlotKeysForOperationType(operationTypeCode));
  return keys
    .map((key) => SLOT_OPTION_BY_KEY.get(key))
    .filter((option): option is ToSelectOption => option != null);
}

export function containerSlotFieldApplies(operationTypeCode: string): boolean {
  return containerSlotKeysForOperationType(operationTypeCode).some((key) => key !== 'na');
}

export function containerSlotFieldLabel(operationTypeCode: string): string {
  switch (operationTypeCode.trim()) {
    case 'portacontenedor':
      return 'Configuración contenedor';
    case 'plataforma':
    case 'modular':
    case 'colectora':
    case 'cama_baja':
      return 'Longitud de plataforma';
    case 'caja_seca':
    case 'refrigerado':
    case 'cortina':
      return 'Longitud de caja';
    case 'otro':
      return 'Configuración / longitud';
    default:
      return 'Configuración';
  }
}

export function defaultContainerSlotForOperationType(
  operationTypeCode: string,
): EquipmentContainerSlotConfigKey {
  const keys = containerSlotKeysForOperationType(operationTypeCode);
  if (keys.length === 1) {
    return keys[0];
  }
  switch (operationTypeCode.trim()) {
    case 'portacontenedor':
      return 'iso_40';
    case 'caja_seca':
    case 'refrigerado':
    case 'cortina':
      return 'ft_53';
    case 'plataforma':
    case 'modular':
    case 'colectora':
    case 'cama_baja':
      return 'ft_48';
    default:
      return keys.find((key) => key !== 'na') ?? 'na';
  }
}

export function resolveContainerSlotConfigKey(
  raw: string | undefined | null,
): EquipmentContainerSlotConfigKey | '' {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (SLOT_OPTION_BY_KEY.has(trimmed)) {
    return trimmed as EquipmentContainerSlotConfigKey;
  }
  const byLabel = valueFromLabel(EQUIPMENT_CONTAINER_SLOT_OPTIONS, trimmed);
  if (byLabel) {
    return byLabel as EquipmentContainerSlotConfigKey;
  }
  if (LEGACY_FIXED_SLOT_LABELS.has(trimmed.toLowerCase())) {
    return 'fixed';
  }
  return '';
}

export function coerceContainerSlotForOperationType(
  operationTypeCode: string,
  currentSlot: string,
): EquipmentContainerSlotConfigKey {
  const allowed = containerSlotKeysForOperationType(operationTypeCode);
  const resolved = resolveContainerSlotConfigKey(currentSlot);
  if (resolved && allowed.includes(resolved)) {
    return resolved;
  }
  return defaultContainerSlotForOperationType(operationTypeCode);
}

export function containerSlotLabelForKey(key: string): string {
  const option = SLOT_OPTION_BY_KEY.get(key);
  return option?.label ?? key;
}
