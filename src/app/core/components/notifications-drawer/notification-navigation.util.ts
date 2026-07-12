import type { NotificationFeedItem } from '@core/services/api/notifications';

export interface NotificationNavigationTarget {
  commands: string[];
  queryParams?: Record<string, string>;
}

export function isNotificationNavigable(item: NotificationFeedItem): boolean {
  return resolveNotificationNavigation(item) != null;
}

function resolveFleetEntityTab(item: NotificationFeedItem): string | null {
  if (item.entityTab?.trim() === 'cob') {
    return 'cob';
  }
  if (item.entityType !== 'unit' && item.entityType !== 'equipment') {
    return null;
  }
  const title = item.title.trim().toLowerCase();
  if (title.includes('pago de gps') || title.includes('pago de seguro')) {
    return 'cob';
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
  if (resolveFleetEntityTab(item) === 'cob') {
    params['fleetTab'] = 'cob';
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
    case 'client':
      return entityId
        ? { commands: ['/clients'], queryParams: { clientId: entityId } }
        : { commands: ['/clients'] };
    case 'trip':
      return entityId
        ? { commands: ['/trips'], queryParams: { tripId: entityId } }
        : null;
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
