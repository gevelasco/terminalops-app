import type { CompanyProfile } from '@core/services/api/companies';
import type { SessionService } from '@core/services/state/session';

export function syncCompanySettingsFromProfile(
  session: SessionService,
  result: CompanyProfile,
): void {
  session.syncCompanyOperationalSettings({
    operationalAnalysisEnabled: result.operationalAnalysisEnabled,
    operationalAnalysisChangedAt: result.operationalAnalysisChangedAt,
    tripAssistPrefillEnabled: result.tripAssistPrefillEnabled,
    tripAssistPrefillChangedAt: result.tripAssistPrefillChangedAt,
    tripAutoMaintenanceProvisionPercent: result.tripAutoMaintenanceProvisionPercent,
    dieselControlEnabled: result.dieselControlEnabled,
    dieselControlChangedAt: result.dieselControlChangedAt,
    maintenanceKmControlEnabled: result.maintenanceKmControlEnabled,
    maintenanceKmIntervalDefault: result.maintenanceKmIntervalDefault,
    maintenanceKmControlChangedAt: result.maintenanceKmControlChangedAt,
    maintenanceDateControlEnabled: result.maintenanceDateControlEnabled,
    maintenanceDatePeriodDefault: result.maintenanceDatePeriodDefault,
    maintenanceDateControlChangedAt: result.maintenanceDateControlChangedAt,
    operationalCenterName: result.operationalCenterName,
    operationalCenterPostalCode: result.operationalCenterPostalCode,
    operationalCenterCityMunicipality: result.operationalCenterCityMunicipality,
    operationalCenterLocality: result.operationalCenterLocality,
    operationalCenterSettlementConsId: result.operationalCenterSettlementConsId,
    operationalCenterLatitude: result.operationalCenterLatitude,
    operationalCenterLongitude: result.operationalCenterLongitude,
  });
}
