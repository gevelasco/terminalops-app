import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ClientsDetailDrawerFacade } from '../clients-detail-drawer.facade';
import {
  CLIENTS_DETAIL_TAB_IMPORTS,
  CLIENTS_DETAIL_TAB_STYLE_URLS,
} from '../clients-detail-tab.shared';

@Component({
  selector: 'app-clients-detail-details-tab',
  imports: [...CLIENTS_DETAIL_TAB_IMPORTS],
  templateUrl: './clients-detail-details-tab.component.html',
  styleUrls: [...CLIENTS_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsDetailDetailsTabComponent {
  protected readonly vm = inject(ClientsDetailDrawerFacade);
}
