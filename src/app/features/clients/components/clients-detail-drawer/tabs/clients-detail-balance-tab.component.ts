import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ClientsDetailDrawerStore } from '../clients-detail-drawer.store';
import {
  CLIENTS_DETAIL_TAB_IMPORTS,
  CLIENTS_DETAIL_TAB_STYLE_URLS,
} from '../clients-detail-tab.shared';

@Component({
  selector: 'app-clients-detail-balance-tab',
  imports: [...CLIENTS_DETAIL_TAB_IMPORTS],
  templateUrl: './clients-detail-balance-tab.component.html',
  styleUrls: [...CLIENTS_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsDetailBalanceTabComponent {
  protected readonly vm = inject(ClientsDetailDrawerStore);
}
