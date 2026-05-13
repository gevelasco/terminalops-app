import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/** Marcas de tractor / OEM habituales en Norteamérica (valor = abrev. operativa). */
export const TRAILER_BRAND_OPTIONS: ToSelectOption[] = [
  { value: 'FRHT', label: 'Freightliner' },
  { value: 'KW', label: 'Kenworth' },
  { value: 'PET', label: 'Peterbilt' },
  { value: 'VOL', label: 'Volvo Trucks' },
  { value: 'INT', label: 'International' },
  { value: 'MACK', label: 'Mack' },
  { value: 'WS', label: 'Western Star' },
  { value: 'STR', label: 'Sterling' },
  { value: 'CAT', label: 'Cat On-Highway' },
  { value: 'HYU', label: 'Hyundai Translead' },
  { value: 'WAB', label: 'Wabash National' },
  { value: 'UT', label: 'Utility Trailer' },
  { value: 'GRT', label: 'Great Dane' },
  { value: 'OTR', label: 'Otra marca' },
];
