import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToClientsMultiInputComponent } from '@shared/ui/to-clients-multi-input/to-clients-multi-input.component';
import { ToPaymentMethodsMultiInputComponent } from '@shared/ui/to-payment-methods-multi-input/to-payment-methods-multi-input.component';
import type { ReportsFilter, ReportsTabId } from '../../models/reports-view.models';
import type { ReportsToolbarTab } from '../../reports.constants';
import {
  rangeForCalendarMonth,
  reportsCalendarMonthOptions,
  reportsCalendarYearOptions,
} from '../../utils/reports-filter';

@Component({
  selector: 'app-reports-filter-bar',
  standalone: true,
  imports: [
    FormsModule,
    ToSegmentControlComponent,
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

  readonly yearOptions = computed(() => reportsCalendarYearOptions());

  readonly monthOptions = computed(() =>
    reportsCalendarMonthOptions(this.filter().periodYear),
  );

  onMonthChange(value: string | number): void {
    this.applyPeriod(Number(value), this.filter().periodYear);
  }

  onYearChange(value: string | number): void {
    const year = Number(value);
    let month = this.filter().periodMonth;
    const allowedMonths = reportsCalendarMonthOptions(year);
    if (!allowedMonths.some((option) => option.value === month)) {
      month = allowedMonths.at(-1)?.value ?? month;
    }
    this.applyPeriod(month, year);
  }

  private applyPeriod(month: number, year: number): void {
    const range = rangeForCalendarMonth(year, month);
    this.filter.update((f) => ({
      ...f,
      periodMonth: month,
      periodYear: year,
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
