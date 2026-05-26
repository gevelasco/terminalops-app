import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperatorsDetailDrawerStore } from '../operators-detail-drawer.store';
import {
  OPERATORS_DETAIL_TAB_IMPORTS,
  OPERATORS_DETAIL_TAB_STYLE_URLS,
} from '../operators-detail-tab.shared';

@Component({
  selector: 'app-operators-detail-operation-tab',
  imports: [...OPERATORS_DETAIL_TAB_IMPORTS],
  templateUrl: './operators-detail-operation-tab.component.html',
  styleUrls: [...OPERATORS_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperatorsDetailOperationTabComponent {
  protected readonly vm = inject(OperatorsDetailDrawerStore);
}
