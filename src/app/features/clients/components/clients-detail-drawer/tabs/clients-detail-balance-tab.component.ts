import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToConfirmDialogComponent } from '@shared/ui/to-confirm-dialog/to-confirm-dialog.component';
import { ToMonthYearPickerComponent } from '@shared/ui/to-month-year-picker/to-month-year-picker.component';
import { ClientsDetailDrawerFacade } from '../clients-detail-drawer.facade';
import {
  CLIENTS_DETAIL_TAB_IMPORTS,
  CLIENTS_DETAIL_TAB_STYLE_URLS,
} from '../clients-detail-tab.shared';

@Component({
  selector: 'app-clients-detail-balance-tab',
  imports: [...CLIENTS_DETAIL_TAB_IMPORTS, ToConfirmDialogComponent, ToMonthYearPickerComponent],
  templateUrl: './clients-detail-balance-tab.component.html',
  styleUrls: [
    './clients-detail-balance-tab.component.scss',
    ...CLIENTS_DETAIL_TAB_STYLE_URLS,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsDetailBalanceTabComponent {
  protected readonly vm = inject(ClientsDetailDrawerFacade);
}
