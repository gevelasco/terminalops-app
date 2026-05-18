import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FLEET_UNIT_DETAIL_TAB_SYMBOLS } from '@features/fleet/utils/fleet-unit-detail-tab-symbols';
import { ToClientsMultiInputComponent } from '@shared/ui/to-clients-multi-input/to-clients-multi-input.component';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import type {
  ReportsClientPaymentMethodFilter,
  ReportsFilter,
  ReportsPeriodPreset,
  ReportsTabId,
} from '../../models/reports-view.models';
import { parseYmd, rangeForPreset } from '../../utils/reports-filter';

export type ReportsToolbarTab = { id: ReportsTabId; label: string };

@Component({
  selector: 'app-reports-filter-bar',
  standalone: true,
  imports: [FormsModule, ToClientsMultiInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-filter-bar.component.html',
  styleUrl: './reports-filter-bar.component.scss',
})
export class ReportsFilterBarComponent {
  readonly fleetTabSymbols = FLEET_UNIT_DETAIL_TAB_SYMBOLS;

  readonly filter = model.required<ReportsFilter>();
  readonly tab = model.required<ReportsTabId>();
  readonly unitOptions = input<ToSelectOption[]>([]);
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

  readonly clientPaymentMethodOptions: {
    value: ReportsClientPaymentMethodFilter;
    label: string;
  }[] = [
    { value: 'both', label: 'Combinado' },
    { value: 'cash', label: 'Efectivo' },
    { value: 'transfer', label: 'Transferencia' },
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

  onClientPaymentMethodChange(value: string): void {
    this.patch({ clientPaymentMethod: value as ReportsClientPaymentMethodFilter });
  }

  selectTab(id: ReportsTabId): void {
    this.tab.set(id);
  }
}
