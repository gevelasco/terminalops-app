import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperatorsDetailDrawerStore } from '../operators-detail-drawer.store';
import {
  OPERATORS_DETAIL_TAB_IMPORTS,
  OPERATORS_DETAIL_TAB_STYLE_URLS,
} from '../operators-detail-tab.shared';

@Component({
  selector: 'app-operators-detail-details-tab',
  imports: [...OPERATORS_DETAIL_TAB_IMPORTS],
  templateUrl: './operators-detail-details-tab.component.html',
  styleUrls: [
    './operators-detail-details-tab.component.scss',
    ...OPERATORS_DETAIL_TAB_STYLE_URLS,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperatorsDetailDetailsTabComponent {
  protected readonly vm = inject(OperatorsDetailDrawerStore);
}
