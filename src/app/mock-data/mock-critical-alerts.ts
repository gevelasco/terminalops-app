import { CriticalAlert } from '@shared/models/logistics.models';

export const MOCK_CRITICAL_ALERTS: CriticalAlert[] = [
  {
    id: 'ca-1',
    severity: 'critical',
    kind: 'cold_chain',
    title: 'Cadena de frío',
    description:
      'Temperatura fuera de rango — remolque TRK-882 · Maniobra VX-24091',
    detectedAt: '2026-05-09T07:42:00Z',
  },
  {
    id: 'ca-2',
    severity: 'critical',
    kind: 'gps',
    title: 'Señal GPS',
    description: 'Pérdida de señal mayor a 15 minutos · Unidad XYZ-909-Z',
    detectedAt: '2026-05-09T06:15:00Z',
  },
  {
    id: 'ca-3',
    severity: 'high',
    kind: 'driver',
    title: 'Tiempo de conducción',
    description:
      'Cercano al límite legal · Op. García / TRK-441 · Ventana de descanso recomendada',
    detectedAt: '2026-05-09T05:50:00Z',
  },
  {
    id: 'ca-4',
    severity: 'high',
    kind: 'maintenance',
    title: 'Refrigeración degradada',
    description:
      'Modo degradado — programar revisión en próxima parada · VX-24088',
    detectedAt: '2026-05-09T04:30:00Z',
  },
  {
    id: 'ca-5',
    severity: 'medium',
    kind: 'schedule',
    title: 'Mantenimiento preventivo',
    description: 'Vencimiento en 48 h · Unidad ABC-101-C',
    detectedAt: '2026-05-08T22:00:00Z',
  },
  {
    id: 'ca-6',
    severity: 'medium',
    kind: 'document',
    title: 'Permiso SCT',
    description:
      'Documentación incompleta para cruce estatal · Expediente EXP-9921',
    detectedAt: '2026-05-08T18:30:00Z',
  },
  {
    id: 'ca-7',
    severity: 'high',
    kind: 'default',
    title: 'Desviación de ruta',
    description:
      'Corredor no autorizado detectado · TRK-204 · Últimas coordenadas hace 8 min',
    detectedAt: '2026-05-08T14:12:00Z',
  },
];
