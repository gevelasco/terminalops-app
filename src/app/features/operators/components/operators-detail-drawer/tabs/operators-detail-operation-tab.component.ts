import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToMonthYearPickerComponent } from '@shared/ui/to-month-year-picker/to-month-year-picker.component';
import { OperatorsDetailDrawerFacade } from '../operators-detail-drawer.facade';
import {
  OPERATORS_DETAIL_TAB_IMPORTS,
  OPERATORS_DETAIL_TAB_STYLE_URLS,
} from '../operators-detail-tab.shared';

@Component({
  selector: 'app-operators-detail-operation-tab',
  imports: [...OPERATORS_DETAIL_TAB_IMPORTS, ToMonthYearPickerComponent],
  templateUrl: './operators-detail-operation-tab.component.html',
  styleUrls: [
    './operators-detail-operation-tab.component.scss',
    ...OPERATORS_DETAIL_TAB_STYLE_URLS,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperatorsDetailOperationTabComponent {
  protected readonly vm = inject(OperatorsDetailDrawerFacade);
}
