import { Alert } from '@shared/models/logistics.models';

export const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    severity: 'warning',
    title: 'Maniobras activas',
    titleIcon: 'maniobras',
    message: '24',
    legend: '+ 12% de la semana pasada',
    createdAt: '2026-05-09T09:00:00Z',
  },
  {
    id: '2',
    severity: 'neutral',
    title: 'Total de Unidades',
    titleIcon: 'units',
    message: '142',
    legend: 'Actualizado hace 5m',
    createdAt: '2026-05-08T18:00:00Z',
  },
  {
    id: '3',
    severity: 'neutral',
    title: 'Equipos en Servicio',
    titleIcon: 'equipment',
    message: '118',
    legend: '22 unidades disponibles',
    createdAt: '2026-05-08T18:00:00Z',
  },
  {
    id: '4',
    severity: 'neutral',
    title: 'Ganancia Mensual',
    titleIcon: 'revenue',
    message: '$1.2M',
    legend: 'Meta: $1.5M',
    createdAt: '2026-05-08T18:00:00Z',
  },
];
