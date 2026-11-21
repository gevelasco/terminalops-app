import {
  DESTINATION_RATE_TRUCK_SPEED_KMH,
  roundSuggestedDriveTimeHours,
  suggestedDriveTimeHoursFromRouteKm,
} from './destination-rate-drive-time.util';

describe('destination-rate-drive-time', () => {
  it('uses 60 km/h effective average', () => {
    expect(DESTINATION_RATE_TRUCK_SPEED_KMH).toBe(60);
  });

  it('roundSuggestedDriveTimeHours uses 0.10 threshold', () => {
    expect(roundSuggestedDriveTimeHours(1)).toBe(1);
    expect(roundSuggestedDriveTimeHours(1.1)).toBe(1);
    expect(roundSuggestedDriveTimeHours(1.11)).toBe(2);
    expect(roundSuggestedDriveTimeHours(1.72)).toBe(2);
    expect(roundSuggestedDriveTimeHours(18.1)).toBe(18);
  });

  it('suggests whole hours from route km', () => {
    expect(suggestedDriveTimeHoursFromRouteKm(120)).toBe(2);
    expect(suggestedDriveTimeHoursFromRouteKm(103)).toBe(2);
    expect(suggestedDriveTimeHoursFromRouteKm(1086)).toBe(18);
  });
});