import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TripsDetailDrawerFacade } from '../trips-detail-drawer.facade';
import {
  TRIPS_DETAIL_TAB_IMPORTS,
  TRIPS_DETAIL_TAB_STYLE_URLS,
} from '../trips-detail-tab.shared';

@Component({
  selector: 'app-trips-detail-settlement-tab',
  imports: [...TRIPS_DETAIL_TAB_IMPORTS],
  templateUrl: './trips-detail-settlement-tab.component.html',
  styleUrls: [...TRIPS_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripsDetailSettlementTabComponent {
  protected readonly vm = inject(TripsDetailDrawerFacade);
}
