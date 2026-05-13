import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { APP_CONFIG, AppConfig } from '@core/tokens/app-config.token';
import { environment } from '../environments/environment';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import { MockManiobraRepository } from '@features/maniobra/data/mock-maniobra.repository';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import { MockOperatorRepository } from '@features/operators/data/mock-operator.repository';
import { UnitRepository } from '@features/fleet/data/unit.repository';
import { MockUnitRepository } from '@features/fleet/data/mock-unit.repository';
import { EquipmentRepository } from '@features/fleet/data/equipment.repository';
import { MockEquipmentRepository } from '@features/fleet/data/mock-equipment.repository';
import { ExpenseRepository } from '@features/expenses/data/expense.repository';
import { MockExpenseRepository } from '@features/expenses/data/mock-expense.repository';
import { AlertRepository } from '@features/dashboard/data/alert.repository';
import { CriticalAlertRepository } from '@features/dashboard/data/critical-alert.repository';
import { MockAlertRepository } from '@features/dashboard/data/mock-alert.repository';
import { MockCriticalAlertRepository } from '@features/dashboard/data/mock-critical-alert.repository';
import { ReportRepository } from '@features/reports/data/report.repository';
import { MockReportRepository } from '@features/reports/data/mock-report.repository';
import { ClientRepository } from '@shared/data/client.repository';
import { MockClientRepository } from '@shared/data/mock-client.repository';

const appConfigValue: AppConfig = {
  apiUrl: environment.apiUrl,
  production: environment.production,
  authDevBypass: environment.authDevBypass,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    { provide: APP_CONFIG, useValue: appConfigValue },
    { provide: ManiobraRepository, useClass: MockManiobraRepository },
    { provide: OperatorRepository, useClass: MockOperatorRepository },
    { provide: UnitRepository, useClass: MockUnitRepository },
    { provide: EquipmentRepository, useClass: MockEquipmentRepository },
    { provide: ExpenseRepository, useClass: MockExpenseRepository },
    { provide: AlertRepository, useClass: MockAlertRepository },
    { provide: CriticalAlertRepository, useClass: MockCriticalAlertRepository },
    { provide: ReportRepository, useClass: MockReportRepository },
    { provide: ClientRepository, useClass: MockClientRepository },
  ],
};
