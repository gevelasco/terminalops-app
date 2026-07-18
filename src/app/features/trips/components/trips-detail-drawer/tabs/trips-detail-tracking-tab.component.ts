import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToFleetBrandComboboxComponent } from '@shared/ui/to-fleet-brand-combobox/to-fleet-brand-combobox.component';
import { TripsDetailDrawerFacade } from '../trips-detail-drawer.facade';
import {
  TRIPS_DETAIL_TAB_IMPORTS,
  TRIPS_DETAIL_TAB_STYLE_URLS,
} from '../trips-detail-tab.shared';

@Component({
  selector: 'app-trips-detail-tracking-tab',
  imports: [...TRIPS_DETAIL_TAB_IMPORTS, ToFleetBrandComboboxComponent],
  templateUrl: './trips-detail-tracking-tab.component.html',
  styleUrls: [...TRIPS_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripsDetailTrackingTabComponent {
  protected readonly vm = inject(TripsDetailDrawerFacade);
}
