import {
  TRIP_POST_COMPLETION_EDIT_DAYS,
  isTripFollowUpLocked,
} from './trip-post-completion-lock';

describe('trip-post-completion-lock', () => {
  const completedAt = '2026-07-01T12:00:00.000Z';
  const completedMs = Date.parse(completedAt);

  it('does not lock in-transit trips', () => {
    expect(
      isTripFollowUpLocked(
        { status: 'in_transit', completedAt },
        completedMs + 30 * 24 * 60 * 60 * 1000,
      ),
    ).toBe(false);
  });

  it('keeps completed trips open within the window', () => {
    expect(
      isTripFollowUpLocked(
        { status: 'completed', completedAt },
        completedMs + (TRIP_POST_COMPLETION_EDIT_DAYS - 1) * 24 * 60 * 60 * 1000,
      ),
    ).toBe(false);
  });

  it('locks completed trips after 7 days', () => {
    expect(
      isTripFollowUpLocked(
        { status: 'completed', completedAt },
        completedMs + TRIP_POST_COMPLETION_EDIT_DAYS * 24 * 60 * 60 * 1000 + 1,
      ),
    ).toBe(true);
  });

  it('falls back to returnAt when completedAt is missing', () => {
    expect(
      isTripFollowUpLocked(
        { status: 'completed', returnAt: completedAt },
        completedMs + TRIP_POST_COMPLETION_EDIT_DAYS * 24 * 60 * 60 * 1000 + 1,
      ),
    ).toBe(true);
  });
});
