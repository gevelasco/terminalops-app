import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  buildReportsBalanceActivityCellStyle,
  buildReportsBalanceActivityHeatmapModel,
  computeReportsBalanceActivityIntensityBounds,
  formatReportsBalanceActivityDayLabel,
  formatReportsBalanceActivityTooltip,
  type ReportsBalanceActivityHeatmapCell,
  type ReportsBalanceActivityHeatmapMonthCell,
} from '@features/reports/utils/reports-balance-activity-heatmap.util';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import type { ReportsBalanceDailyActivityDay } from '@shared/models/api/api-reports-balance.model';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';

interface ReportsBalanceActivityTooltipState {
  text: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-reports-balance-activity-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyMxPipe],
  templateUrl: './reports-balance-activity-heatmap.component.html',
  styleUrl: './reports-balance-activity-heatmap.component.scss',
})
export class ReportsBalanceActivityHeatmapComponent {
  private readonly currencyMx = inject(CurrencyMxPipe);

  readonly dailyActivity = input<readonly ReportsBalanceDailyActivityDay[]>([]);
  readonly filter = input.required<ReportsFilter>();

  readonly model = computed(() =>
    buildReportsBalanceActivityHeatmapModel(
      this.dailyActivity(),
      this.filter().from,
      this.filter().to,
    ),
  );

  readonly intensityBounds = computed(() =>
    computeReportsBalanceActivityIntensityBounds(this.model()),
  );

  readonly cellsByDate = computed(() => {
    const map = new Map<string, ReportsBalanceActivityHeatmapCell>();
    for (const cell of this.model().dayCells) {
      map.set(cell.date, cell);
    }
    return map;
  });

  calendarCell(ymd: string, day: number, inMonth: boolean): ReportsBalanceActivityHeatmapCell {
    const from = this.filter().from;
    const to = this.filter().to;
    return (
      this.cellsByDate().get(ymd) ?? {
        date: ymd,
        day,
        inRange: ymd >= from && ymd <= to,
        inMonth,
        incomeCount: 0,
        expenseCount: 0,
        receivableCount: 0,
        payableCount: 0,
        events: [],
      }
    );
  }

  readonly tooltip = signal<ReportsBalanceActivityTooltipState | null>(null);

  cellClasses(cell: ReportsBalanceActivityHeatmapCell): string {
    const classes = ['reports-balance-activity-cell'];
    if (!cell.inRange) {
      classes.push('reports-balance-activity-cell--muted');
      return classes.join(' ');
    }
    const heat = buildReportsBalanceActivityCellStyle(
      cell.incomeCount,
      cell.expenseCount,
      this.intensityBounds(),
      cell.receivableCount,
      cell.payableCount,
    );
    if (!heat) {
      classes.push('reports-balance-activity-cell--empty');
      return classes.join(' ');
    }
    const activeKinds = (cell.incomeCount > 0 ? 1 : 0) + (cell.expenseCount > 0 ? 1 : 0) + (cell.receivableCount > 0 ? 1 : 0) + (cell.payableCount > 0 ? 1 : 0);
    if (activeKinds > 1) {
      classes.push('reports-balance-activity-cell--mixed');
    } else if (cell.incomeCount > 0) {
      classes.push('reports-balance-activity-cell--income');
    } else if (cell.receivableCount > 0) {
      classes.push('reports-balance-activity-cell--receivable');
    } else if (cell.payableCount > 0) {
      classes.push('reports-balance-activity-cell--payable');
    } else {
      classes.push('reports-balance-activity-cell--expense');
    }
    if (heat.hot) {
      classes.push('reports-balance-activity-cell--hot');
    }
    return classes.join(' ');
  }

  monthCellClasses(cell: ReportsBalanceActivityHeatmapMonthCell): string {
    const classes = ['reports-balance-activity-month-cell'];
    const heat = buildReportsBalanceActivityCellStyle(
      cell.incomeCount,
      cell.expenseCount,
      this.intensityBounds(),
      cell.receivableCount,
      cell.payableCount,
    );
    if (!heat) {
      classes.push('reports-balance-activity-month-cell--empty');
      return classes.join(' ');
    }
    const activeKinds = (cell.incomeCount > 0 ? 1 : 0) + (cell.expenseCount > 0 ? 1 : 0) + (cell.receivableCount > 0 ? 1 : 0) + (cell.payableCount > 0 ? 1 : 0);
    if (activeKinds > 1) {
      classes.push('reports-balance-activity-month-cell--mixed');
    } else if (cell.incomeCount > 0) {
      classes.push('reports-balance-activity-month-cell--income');
    } else if (cell.receivableCount > 0) {
      classes.push('reports-balance-activity-month-cell--receivable');
    } else if (cell.payableCount > 0) {
      classes.push('reports-balance-activity-month-cell--payable');
    } else {
      classes.push('reports-balance-activity-month-cell--expense');
    }
    if (heat.hot) {
      classes.push('reports-balance-activity-month-cell--hot');
    }
    return classes.join(' ');
  }

  cellStyle(cell: ReportsBalanceActivityHeatmapCell): Record<string, string> {
    if (!cell.inRange) {
      return {};
    }
    const heat = buildReportsBalanceActivityCellStyle(
      cell.incomeCount,
      cell.expenseCount,
      this.intensityBounds(),
      cell.receivableCount,
      cell.payableCount,
    );
    if (!heat) {
      return {};
    }
    return {
      background: heat.background,
      borderColor: heat.borderColor,
    };
  }

  monthCellStyle(cell: ReportsBalanceActivityHeatmapMonthCell): Record<string, string> {
    const heat = buildReportsBalanceActivityCellStyle(
      cell.incomeCount,
      cell.expenseCount,
      this.intensityBounds(),
      cell.receivableCount,
      cell.payableCount,
    );
    if (!heat) {
      return {};
    }
    return {
      background: heat.background,
      borderColor: heat.borderColor,
    };
  }

  cellCountLabel(cell: ReportsBalanceActivityHeatmapCell): string {
    const total = cell.incomeCount + cell.expenseCount + cell.receivableCount + cell.payableCount;
    return total > 0 ? String(total) : '';
  }

  monthCountLabel(cell: ReportsBalanceActivityHeatmapMonthCell): string {
    const total = cell.incomeCount + cell.expenseCount + cell.receivableCount + cell.payableCount;
    return total > 0 ? String(total) : '—';
  }

  showTooltip(
    event: MouseEvent,
    dateLabel: string,
    events: ReportsBalanceActivityHeatmapCell['events'],
  ): void {
    if (events.length === 0) {
      this.tooltip.set(null);
      return;
    }
    const host = (event.currentTarget as HTMLElement).closest(
      '.reports-balance-activity-heatmap',
    ) as HTMLElement | null;
    if (!host) {
      return;
    }
    const rect = host.getBoundingClientRect();
    this.tooltip.set({
      text: formatReportsBalanceActivityTooltip(dateLabel, events, (value) =>
        this.currencyMx.transform(value),
      ),
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top + 12,
    });
  }

  hideTooltip(): void {
    this.tooltip.set(null);
  }

  dayLabel(ymd: string): string {
    return formatReportsBalanceActivityDayLabel(ymd);
  }
}
