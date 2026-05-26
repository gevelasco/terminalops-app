import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ManiobraDetailDrawerStore } from '../maniobra-detail-drawer.store';
import {
  MANIOBRA_DETAIL_TAB_IMPORTS,
  MANIOBRA_DETAIL_TAB_STYLE_URLS,
} from '../maniobra-detail-tab.shared';

@Component({
  selector: 'app-maniobra-detail-tracking-tab',
  imports: [...MANIOBRA_DETAIL_TAB_IMPORTS],
  templateUrl: './maniobra-detail-tracking-tab.component.html',
  styleUrls: [...MANIOBRA_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManiobraDetailTrackingTabComponent {
  protected readonly vm = inject(ManiobraDetailDrawerStore);
}
