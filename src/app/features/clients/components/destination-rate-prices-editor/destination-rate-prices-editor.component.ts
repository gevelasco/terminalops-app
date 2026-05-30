import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
} from '@angular/core';
import { ToastService } from '@core/notifications/toast.service';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import {
  createEmptyPriceDraft,
  parseRateMoneyInput,
} from '@features/clients/utils/destination-rate-payload';
import type { DestinationRatePriceDraft } from '@shared/models/destination-rate.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import {
  DestinationRateManeuverComboboxComponent,
  type DestinationRateManeuverValue,
} from './destination-rate-maneuver-combobox.component';

@Component({
  selector: 'app-destination-rate-prices-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToInputComponent,
    ToButtonComponent,
    ToIconComponent,
    DestinationRateManeuverComboboxComponent,
  ],
  templateUrl: './destination-rate-prices-editor.component.html',
  styleUrl: './destination-rate-prices-editor.component.scss',
})
export class DestinationRatePricesEditorComponent {
  private readonly toast = inject(ToastService);
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService);

  readonly priceDrafts = model<DestinationRatePriceDraft[]>([createEmptyPriceDraft()]);
  readonly disabled = model(false);

  readonly configurationOptions = computed((): ToSelectOption[] =>
    this.operationConfigs.activeConfigurations().map((c) => ({
      value: c.id,
      label: c.name,
    })),
  );

  readonly allConfigurationNames = computed(() =>
    this.operationConfigs.configurations().map((c) => ({ id: c.id, name: c.name })),
  );

  readonly usedConfigurationIds = computed(() => {
    const ids = new Set<string>();
    for (const row of this.priceDrafts()) {
      const id = row.operationConfigurationId.trim();
      if (id) {
        ids.add(id);
      }
    }
    return ids;
  });

  availableOptionsForRow(row: DestinationRatePriceDraft): ToSelectOption[] {
    const used = this.usedConfigurationIds();
    return this.configurationOptions().filter(
      (opt) => opt.value === row.operationConfigurationId || !used.has(String(opt.value)),
    );
  }

  addRow(): void {
    this.priceDrafts.update((rows) => [...rows, createEmptyPriceDraft()]);
  }

  removeRow(rowKey: string): void {
    this.priceDrafts.update((rows) => {
      if (rows.length <= 1) {
        this.toast.show('Debe existir al menos un tipo de maniobra.', 'warning');
        return rows;
      }
      return rows.filter((r) => r.rowKey !== rowKey);
    });
  }

  onManeuverChange(rowKey: string, value: DestinationRateManeuverValue): void {
    this.priceDrafts.update((rows) =>
      rows.map((row) =>
        row.rowKey === rowKey
          ? {
              ...row,
              operationConfigurationId: value.operationConfigurationId,
              operationConfigurationName: value.operationConfigurationName,
            }
          : row,
      ),
    );
  }

  updateField(
    rowKey: string,
    field: 'clientCharge' | 'operatorPaymentEstimate' | 'estimatedTollAmount' | 'notes',
    value: string,
  ): void {
    this.priceDrafts.update((rows) =>
      rows.map((row) => (row.rowKey === rowKey ? { ...row, [field]: value } : row)),
    );
  }

  rowHasValidAmounts(row: DestinationRatePriceDraft): boolean {
    return (
      parseRateMoneyInput(row.clientCharge) !== undefined &&
      parseRateMoneyInput(row.operatorPaymentEstimate) !== undefined &&
      parseRateMoneyInput(row.estimatedTollAmount) !== undefined
    );
  }
}
