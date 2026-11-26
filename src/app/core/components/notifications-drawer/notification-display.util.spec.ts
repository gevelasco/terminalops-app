import type { NotificationFeedItem } from '@core/services/api/notifications';
import {
  enrichNotificationFeedItem,
  resolveNotificationIcon,
  resolveNotificationTitle,
} from './notification-display.util';

function item(
  partial: Partial<NotificationFeedItem> & Pick<NotificationFeedItem, 'id'>,
): NotificationFeedItem {
  return {
    kind: 'payment.due_soon',
    origin: 'event',
    icon: 'route',
    title: 'Pago de seguro próximo',
    subjectLabel: 'M-1042',
    occurredAt: '2026-08-28T18:00:00.000Z',
    actorLabel: 'Ana',
    ...partial,
  };
}

describe('resolveNotificationTitle', () => {
  it('replaces the generic trip update with the maneuver-data label', () => {
    expect(
      resolveNotificationTitle(
        item({ id: '1', kind: 'trip.updated', title: 'Maniobra modificada' }),
      ),
    ).toBe('Datos de maniobra');
  });

  it('labels trip mutations by kind', () => {
    expect(
      resolveNotificationTitle(item({ id: '2', kind: 'trip.expense_added' })),
    ).toBe('Gasto agregado');
    expect(
      resolveNotificationTitle(item({ id: '3', kind: 'trip.document_added' })),
    ).toBe('Documento agregado');
    expect(
      resolveNotificationTitle(item({ id: '4', kind: 'trip.tracking_updated' })),
    ).toBe('Actualización de fechas');
  });

  it('labels fleet mutations by drawer section', () => {
    expect(
      resolveNotificationTitle(item({ id: '6', kind: 'unit.ficha_updated' })),
    ).toBe('Ficha técnica');
    expect(
      resolveNotificationTitle(item({ id: '7', kind: 'unit.coverage_updated' })),
    ).toBe('Cobertura');
    expect(
      resolveNotificationTitle(
        item({ id: '8', kind: 'equipment.maintenance_updated' }),
      ),
    ).toBe('Mantenimiento');
  });

  it('keeps unrelated titles', () => {
    expect(
      resolveNotificationTitle(
        item({ id: '5', kind: 'payment.due_soon', title: 'Pago de GPS próximo' }),
      ),
    ).toBe('Pago de GPS próximo');
  });
});

describe('resolveNotificationIcon', () => {
  it('picks an icon that matches the trip mutation', () => {
    expect(
      resolveNotificationIcon(item({ id: '1', kind: 'trip.document_added' })),
    ).toBe('document');
    expect(
      resolveNotificationIcon(item({ id: '2', kind: 'trip.tracking_updated' })),
    ).toBe('tracking');
    expect(
      resolveNotificationIcon(item({ id: '3', kind: 'trip.expense_added' })),
    ).toBe('settlement');
  });
});

describe('enrichNotificationFeedItem', () => {
  it('rewrites title and icon for the drawer', () => {
    const enriched = enrichNotificationFeedItem(
      item({ id: '1', kind: 'trip.updated', title: 'Maniobra modificada' }),
    );
    expect(enriched.title).toBe('Datos de maniobra');
    expect(enriched.icon).toBe('route');
  });

  it('does not attribute a payment confirmation to the system', () => {
    const enriched = enrichNotificationFeedItem(
      item({
        id: '9',
        kind: 'coverage.payment_confirmed',
        title: 'Pago de verificación confirmado',
        actorLabel: 'Sistema',
      }),
    );
    expect(enriched.actorLabel).toBe('');
  });
});
