import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToClientsMultiInputComponent } from '@shared/ui/to-clients-multi-input/to-clients-multi-input.component';
import { ToPaymentMethodsMultiInputComponent } from '@shared/ui/to-payment-methods-multi-input/to-payment-methods-multi-input.component';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import type {
  ReportsFilter,
  ReportsPeriodPreset,
  ReportsTabId,
} from '../../models/reports-view.models';
import type { ReportsToolbarTab } from '../../reports.constants';
import { parseYmd, rangeForPreset } from '../../utils/reports-filter';

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

  readonly periodRangeLabel = computed(() => {
    const f = this.filter();
    const a = parseYmd(f.from);
    const b = parseYmd(f.to);
    if (!a || !b) {
      return '';
    }
    const fmt = new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: a.getFullYear() !== b.getFullYear() ? 'numeric' : undefined,
    });
    return `${fmt.format(a)} – ${fmt.format(b)}`;
  });

  readonly presetOptions: ToSelectOption[] = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'quarter', label: 'Trimestre' },
    { value: 'semester', label: 'Semestre' },
    { value: 'year', label: 'Año' },
  ];

  onPresetChange(value: string): void {
    const preset = value as ReportsPeriodPreset;
    const range = rangeForPreset(preset);
    this.filter.update((f) => ({
      ...f,
      preset,
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
