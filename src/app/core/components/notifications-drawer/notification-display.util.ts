import type { NotificationFeedItem } from '@core/services/api/notifications';

const TITLE_BY_KIND: Record<string, string> = {
  'trip.updated': 'Datos de maniobra',
  'trip.expense_added': 'Gasto agregado',
  'trip.document_added': 'Documento agregado',
  'trip.tracking_updated': 'Actualización de fechas',
  'unit.ficha_updated': 'Ficha técnica',
  'unit.coverage_updated': 'Cobertura',
  'unit.maintenance_updated': 'Mantenimiento',
  'equipment.ficha_updated': 'Ficha técnica',
  'equipment.coverage_updated': 'Cobertura',
  'equipment.maintenance_updated': 'Mantenimiento',
};

const ICON_BY_KIND: Record<string, string> = {
  'trip.document_added': 'document',
  'trip.tracking_updated': 'tracking',
  'trip.expense_added': 'settlement',
  'trip.reminder.load': 'route',
  'trip.reminder.departure': 'route',
  'trip.reminder.arrival': 'route',
  'trip.reminder.completion': 'route',
  'trip.reminder.empty_delivery': 'route',
  'unit.coverage_updated': 'document',
  'unit.maintenance_updated': 'maintenance',
  'equipment.coverage_updated': 'document',
  'equipment.maintenance_updated': 'maintenance',
};

function isGenericTripUpdatedTitle(title: string): boolean {
  return title.trim().toLowerCase() === 'maniobra modificada';
}

function isSystemAttributedPaymentTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return (
    normalized.includes('pago de') && normalized.includes('confirmado')
  ) || normalized.includes('cuota de financiamiento confirmada');
}

export function resolveNotificationTitle(item: NotificationFeedItem): string {
  const kindTitle = TITLE_BY_KIND[item.kind];
  if (kindTitle) {
    return kindTitle;
  }
  if (isGenericTripUpdatedTitle(item.title)) {
    return 'Datos de maniobra';
  }
  return item.title;
}

export function resolveNotificationIcon(item: NotificationFeedItem): string {
  return ICON_BY_KIND[item.kind] ?? item.icon;
}

export function resolveNotificationActor(item: NotificationFeedItem): string {
  const actor = item.actorLabel.trim();
  if (
    actor.toLowerCase() === 'sistema' &&
    isSystemAttributedPaymentTitle(item.title)
  ) {
    return '';
  }
  return item.actorLabel;
}

/** Titles/icons the drawer shows; keeps search aligned with the visible copy. */
export function enrichNotificationFeedItem(
  item: NotificationFeedItem,
): NotificationFeedItem {
  return {
    ...item,
    title: resolveNotificationTitle(item),
    icon: resolveNotificationIcon(item),
    actorLabel: resolveNotificationActor(item),
  };
}
