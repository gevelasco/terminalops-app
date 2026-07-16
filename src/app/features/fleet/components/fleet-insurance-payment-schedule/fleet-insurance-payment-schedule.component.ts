import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  ViewChild,
} from '@angular/core';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { InsuranceScheduleRow } from '@features/fleet/utils/fleet-insurance-schedule.util';
import { insuranceScheduleStatusLabel } from '@features/fleet/utils/fleet-insurance-schedule.util';

@Component({
  selector: 'app-fleet-insurance-payment-schedule',
  imports: [ToIconComponent],
  templateUrl: './fleet-insurance-payment-schedule.component.html',
  styleUrls: ['./fleet-insurance-payment-schedule.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetInsurancePaymentScheduleComponent implements AfterViewChecked {
  readonly schedule = input.required<readonly InsuranceScheduleRow[]>();
  readonly saving = input(false);
  readonly canConfirmPayments = input(true);
  readonly formatDate = input.required<(ymd: string | undefined) => string>();
  readonly formatAmount = input.required<(amount: number | undefined) => string>();

  readonly confirmCycle = output<string>();

  @ViewChild('scrollBody') private scrollBody?: ElementRef<HTMLElement>;
  private lastScrolledKey = '';

  readonly visibleSchedule = computed(() => this.schedule());

  ngAfterViewChecked(): void {
    const rows = this.schedule();
    if (!rows.length || !this.scrollBody) return;
    const key = rows.map((r) => `${r.dueDate}:${r.status}`).join('|');
    if (key === this.lastScrolledKey) return;
    this.lastScrolledKey = key;

    const el = this.scrollBody.nativeElement;
    const firstUnpaidIdx = rows.findIndex((r) => r.status !== 'paid');
    const targetIdx = firstUnpaidIdx > 0 ? firstUnpaidIdx - 1 : firstUnpaidIdx >= 0 ? 0 : rows.length - 1;
    const targetRow = el.querySelector(`tr[data-idx="${targetIdx}"]`) as HTMLElement | null;
    if (targetRow) {
      targetRow.scrollIntoView({ block: 'start' });
    }
  }

  statusLabel(status: InsuranceScheduleRow['status']): string {
    return insuranceScheduleStatusLabel(status);
  }

  onConfirm(dueDate: string): void {
    this.confirmCycle.emit(dueDate);
  }
}
