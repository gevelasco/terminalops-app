import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ManiobraDetailDrawerStore } from '../maniobra-detail-drawer.store';
import {
  MANIOBRA_DETAIL_TAB_IMPORTS,
  MANIOBRA_DETAIL_TAB_STYLE_URLS,
} from '../maniobra-detail-tab.shared';

@Component({
  selector: 'app-maniobra-detail-settlement-tab',
  imports: [...MANIOBRA_DETAIL_TAB_IMPORTS],
  templateUrl: './maniobra-detail-settlement-tab.component.html',
  styleUrls: [...MANIOBRA_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManiobraDetailSettlementTabComponent {
  protected readonly vm = inject(ManiobraDetailDrawerStore);
}
