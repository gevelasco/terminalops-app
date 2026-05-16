import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/** Configuración de vanos / contenedor (ISO o fijo). */
export const EQUIPMENT_CONTAINER_SLOT_OPTIONS: ToSelectOption[] = [
  { value: 'na', label: 'No aplica' },
  { value: 'fixed', label: 'Chasis fijo / cerrado' },
  { value: 'iso_40', label: "40′ (un contenedor)" },
  { value: 'iso_20', label: "20′ (un contenedor)" },
  { value: 'iso_20_20', label: "20′ + 20′ (dos contenedores)" },
];
