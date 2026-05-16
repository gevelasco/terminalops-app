import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  expenseFleetRelationDetail,
  expenseKindLabel,
  expenseManeuverCode,
  expensePaymentMethodLabel,
} from '@features/expenses/utils/expense-row-labels';
import { EXPENSE_VERIFICATION_SCOPE_OPTIONS } from '@shared/catalogs/expense-form-options';
import type { Expense } from '@shared/models/logistics.models';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';

@Component({
  selector: 'app-expenses-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToDrawerSkeletonComponent, ToIconButtonComponent],
  templateUrl: './expenses-detail-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
  ],
})
export class ExpensesDetailDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currencyMx = inject(CurrencyMxPipe);
  private readonly dateShort = inject(DateShortPipe);

  readonly expense = input.required<Expense>();
  /** Resuelve `tripId` interno → código de maniobra. */
  readonly tripManeuverByTripId =
    input<ReadonlyMap<string, string> | undefined>(undefined);
  readonly dismiss = output<void>();
  readonly drawerLoading = signal(true);

  constructor() {
    this.doc.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });
    afterNextRender(() => this.drawerLoading.set(false));
  }

  kindLabel(): string {
    return expenseKindLabel(this.expense().kind);
  }

  maneuverCode(): string {
    return expenseManeuverCode(this.expense(), this.tripManeuverByTripId());
  }

  fleetRelationDetail(): string {
    return expenseFleetRelationDetail(this.expense());
  }

  showFleetRelation(): boolean {
    return this.fleetRelationDetail() !== '—';
  }

  paymentLabel(): string {
    return expensePaymentMethodLabel(this.expense().paymentMethod);
  }

  verificationTypeLabel(): string {
    const v = this.expense().verificationScope;
    if (!v) {
      return '—';
    }
    return (
      EXPENSE_VERIFICATION_SCOPE_OPTIONS.find((o) => o.value === v)?.label ?? v
    );
  }

  invoiceRequiredLabel(): string {
    return this.expense().invoiceRequired === true ? 'Sí' : 'No';
  }

  amountFormatted(): string {
    const e = this.expense();
    return this.currencyMx.transform(e.amount, e.currency);
  }

  dateFormatted(): string {
    return this.dateShort.transform(this.expense().incurredAt);
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
