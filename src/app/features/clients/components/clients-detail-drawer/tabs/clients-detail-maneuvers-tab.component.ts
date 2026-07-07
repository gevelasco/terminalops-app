import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ClientsDetailDrawerFacade } from '../clients-detail-drawer.facade';
import {
  CLIENTS_DETAIL_TAB_IMPORTS,
  CLIENTS_DETAIL_TAB_STYLE_URLS,
} from '../clients-detail-tab.shared';
import { ToFilterTabsComponent } from '@shared/ui/to-filter-tabs/to-filter-tabs.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

@Component({
  selector: 'app-clients-detail-maneuvers-tab',
  imports: [
    ...CLIENTS_DETAIL_TAB_IMPORTS,
    ToFilterTabsComponent,
    ToTableComponent,
  ],
  templateUrl: './clients-detail-maneuvers-tab.component.html',
  styleUrls: [
    './clients-detail-maneuvers-tab.component.scss',
    ...CLIENTS_DETAIL_TAB_STYLE_URLS,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsDetailManeuversTabComponent {
  protected readonly vm = inject(ClientsDetailDrawerFacade);

  readonly columns: ToTableColumn[] = [
    { key: 'maneuverCode', label: 'Código' },
    { key: 'departureAt', label: 'Salida' },
    { key: 'destination', label: 'Destino' },
    { key: 'operationType', label: 'Config.', cell: 'operation-type' },
    { key: 'clientCharge', label: 'Pactado' },
    { key: 'costs', label: 'Costos' },
    { key: 'collectedStatus', label: 'Cobro', cell: 'trip-collected-icon' },
  ];
}
