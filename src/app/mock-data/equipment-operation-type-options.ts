import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/**
 * Tipo de unidad / caja (operación México): portacontenedor, plataforma, etc.
 */
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
