import type { NotificationFeedItem } from '@core/services/api/notifications';

export interface NotificationNavigationTarget {
  commands: string[];
  queryParams?: Record<string, string>;
}

export function isNotificationNavigable(item: NotificationFeedItem): boolean {
  return resolveNotificationNavigation(item) != null;
}

function resolveFleetEntityTab(item: NotificationFeedItem): string | null {
  const tab = item.entityTab?.trim();
  if (tab === 'cob' || tab === 'ficha' || tab === 'mant') {
    return tab;
  }
  if (item.kind.endsWith('.coverage_updated')) {
    return 'cob';
  }
  if (item.kind.endsWith('.maintenance_updated')) {
    return 'mant';
  }
  if (item.kind.endsWith('.ficha_updated')) {
    return 'ficha';
  }
  if (item.entityType !== 'unit' && item.entityType !== 'equipment') {
    return null;
  }
  const title = item.title.trim().toLowerCase();
  if (title === 'cobertura' || title.includes('pago de gps') || title.includes('pago de seguro')) {
    return 'cob';
  }
  if (
    title.includes('pago de verificación') ||
    title.includes('cuota de financiamiento')
  ) {
    return 'cob';
  }
  if (title === 'mantenimiento') {
    return 'mant';
  }
  if (title === 'ficha técnica') {
    return 'ficha';
  }
  return null;
}

function resolveClientEntityTab(item: NotificationFeedItem): string | null {
  const tab = item.entityTab?.trim();
  if (tab === 'details' || tab === 'balance') {
    return tab;
  }
  if (item.kind === 'client.updated') {
    return 'details';
  }
  const title = item.title.trim().toLowerCase();
  if (
    title === 'cliente modificado' ||
    title === 'detalles' ||
    title.includes('identificación') ||
    title.includes('fiscal') ||
    title.includes('entrega') ||
    title.includes('contacto') ||
    title.includes('cobro')
  ) {
    return 'details';
  }
  return null;
}

function fleetQueryParams(
  unitId: string | null,
  equipmentId: string | null,
  item: NotificationFeedItem,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (unitId) {
    params['unitId'] = unitId;
  }
  if (equipmentId) {
    params['equipmentId'] = equipmentId;
  }
  const tab = resolveFleetEntityTab(item);
  if (tab) {
    params['fleetTab'] = tab;
  }
  return params;
}

export function resolveNotificationNavigation(
  item: NotificationFeedItem,
): NotificationNavigationTarget | null {
  const entityType = item.entityType?.trim();
  if (!entityType) {
    return null;
  }

  const entityId = item.entityId?.trim() ?? '';

  switch (entityType) {
    case 'client': {
      const queryParams: Record<string, string> = {};
      if (entityId) {
        queryParams['clientId'] = entityId;
      }
      const tab = resolveClientEntityTab(item);
      if (tab) {
        queryParams['clientTab'] = tab;
      }
      return Object.keys(queryParams).length > 0
        ? { commands: ['/comercial/clients'], queryParams }
        : { commands: ['/comercial/clients'] };
    }
    case 'trip': {
      if (!entityId) {
        return null;
      }
      const queryParams: Record<string, string> = { tripId: entityId };
      if (item.kind.startsWith('trip.reminder.')) {
        queryParams['detailTab'] = 'tracking';
      } else if (item.entityTab?.trim() === 'tracking') {
        queryParams['detailTab'] = 'tracking';
      }
      return { commands: ['/trips'], queryParams };
    }
    case 'expense':
      return entityId
        ? { commands: ['/expenses'], queryParams: { expenseId: entityId } }
        : { commands: ['/expenses'] };
    case 'expenses':
      return { commands: ['/expenses'] };
    case 'unit':
      return entityId
        ? {
            commands: ['/fleet'],
            queryParams: fleetQueryParams(entityId, null, item),
          }
        : { commands: ['/fleet'] };
    case 'equipment':
      return entityId
        ? {
            commands: ['/fleet'],
            queryParams: fleetQueryParams(null, entityId, item),
          }
        : { commands: ['/fleet'] };
    case 'operator':
      return entityId
        ? { commands: ['/operators'], queryParams: { operatorId: entityId } }
        : { commands: ['/operators'] };
    default:
      return null;
  }
}
