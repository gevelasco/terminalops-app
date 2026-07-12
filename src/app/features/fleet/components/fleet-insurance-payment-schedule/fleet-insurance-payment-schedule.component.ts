import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { InsuranceScheduleRow } from '@features/fleet/utils/fleet-insurance-schedule.util';
import {
  compactInsurancePaymentSchedule,
  insuranceScheduleStatusLabel,
} from '@features/fleet/utils/fleet-insurance-schedule.util';

@Component({
  selector: 'app-fleet-insurance-payment-schedule',
  imports: [ToIconComponent],
  templateUrl: './fleet-insurance-payment-schedule.component.html',
  styleUrls: ['./fleet-insurance-payment-schedule.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetInsurancePaymentScheduleComponent {
  readonly schedule = input.required<readonly InsuranceScheduleRow[]>();
  readonly saving = input(false);
  readonly canConfirmPayments = input(true);
  readonly formatDate = input.required<(ymd: string | undefined) => string>();
  readonly formatAmount = input.required<(amount: number | undefined) => string>();

  readonly confirmCycle = output<string>();

  readonly visibleSchedule = computed(() => compactInsurancePaymentSchedule(this.schedule()));

  statusLabel(status: InsuranceScheduleRow['status']): string {
    return insuranceScheduleStatusLabel(status);
  }

  onConfirm(dueDate: string): void {
    this.confirmCycle.emit(dueDate);
  }
}
