import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import {
  ToMonthYearPickerComponent,
  type ToMonthYearValue,
} from '@shared/ui/to-month-year-picker/to-month-year-picker.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToClientsMultiInputComponent } from '@shared/ui/to-clients-multi-input/to-clients-multi-input.component';
import { ToPaymentMethodsMultiInputComponent } from '@shared/ui/to-payment-methods-multi-input/to-payment-methods-multi-input.component';
import type { ReportsFilter, ReportsTabId } from '../../models/reports-view.models';
import type { ReportsToolbarTab } from '../../reports.constants';
import { compareMonthYear, rangeForMonthYearSpan } from '../../utils/reports-filter';

@Component({
  selector: 'app-reports-filter-bar',
  standalone: true,
  imports: [
    ToSegmentControlComponent,
    ToMonthYearPickerComponent,
    ToClientsMultiInputComponent,
    ToPaymentMethodsMultiInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-filter-bar.component.html',
  styleUrl: './reports-filter-bar.component.scss',
})
export class ReportsFilterBarComponent {
  readonly filter = model.required<ReportsFilter>();
  readonly tab = model.required<ReportsTabId>();
  readonly tabs = input<ReportsToolbarTab[]>([]);

  readonly currentMonthYear = computed((): ToMonthYearValue => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  readonly fromValue = computed((): ToMonthYearValue => ({
    month: this.filter().fromMonth,
    year: this.filter().fromYear,
  }));

  readonly toValue = computed((): ToMonthYearValue => ({
    month: this.filter().toMonth,
    year: this.filter().toYear,
  }));

  onFromChange(value: ToMonthYearValue): void {
    const f = this.filter();
    let toMonth = f.toMonth;
    let toYear = f.toYear;
    if (compareMonthYear(value, { month: toMonth, year: toYear }) > 0) {
      toMonth = value.month;
      toYear = value.year;
    }
    this.applyRange(value.month, value.year, toMonth, toYear);
  }

  onToChange(value: ToMonthYearValue): void {
    const f = this.filter();
    let fromMonth = f.fromMonth;
    let fromYear = f.fromYear;
    if (compareMonthYear({ month: fromMonth, year: fromYear }, value) > 0) {
      fromMonth = value.month;
      fromYear = value.year;
    }
    this.applyRange(fromMonth, fromYear, value.month, value.year);
  }

  private applyRange(
    fromMonth: number,
    fromYear: number,
    toMonth: number,
    toYear: number,
  ): void {
    const range = rangeForMonthYearSpan(fromMonth, fromYear, toMonth, toYear);
    this.filter.update((f) => ({
      ...f,
      fromMonth,
      fromYear,
      toMonth,
      toYear,
      from: range.from,
      to: range.to,
    }));
  }

  patch(partial: Partial<ReportsFilter>): void {
    this.filter.update((f) => ({ ...f, ...partial }));
  }

  selectTab(id: ReportsTabId): void {
    this.tab.set(id);
  }
}
