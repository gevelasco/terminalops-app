import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Expense } from '@shared/models/logistics.models';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToConfirmDialogComponent } from '@shared/ui/to-confirm-dialog/to-confirm-dialog.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
} from '@shared/ui/to-select/to-select.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';
import { ExpenseOperationalRelationFieldsComponent } from '@features/expenses/components/expense-operational-relation-fields/expense-operational-relation-fields.component';
import { ExpensesDetailDrawerFacade } from './expenses-detail-drawer.facade';

@Component({
  selector: 'app-expenses-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExpensesDetailDrawerFacade, CurrencyMxPipe, DateShortPipe],
  imports: [
    FormsModule,
    ToButtonComponent,
    ToConfirmDialogComponent,
    ToIconComponent,
    ToInputComponent,
    ToSelectComponent,
    ToSideDrawerComponent,
    ToTextareaComponent,
    ExpenseOperationalRelationFieldsComponent,
  ],
  templateUrl: './expenses-detail-drawer.component.html',
  styleUrls: [
    './expenses-detail-drawer.component.scss',
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/styles/fleet-detail-drawer-footer.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
  ],
})
export class ExpensesDetailDrawerComponent {
  protected readonly vm = inject(ExpensesDetailDrawerFacade);

  readonly expense = input.required<Expense>();
  readonly tripManeuverByTripId =
    input<ReadonlyMap<string, string> | undefined>(undefined);
  readonly dismiss = output<void>();
  readonly updated = output<Expense>();
  readonly deleted = output<void>();

  constructor() {
    this.vm.bindCallbacks(
      (expense) => this.updated.emit(expense),
      () => this.dismiss.emit(),
      () => this.deleted.emit(),
    );

    effect(() => {
      this.vm.setExpense(this.expense());
      this.vm.setTripManeuverByTripId(this.tripManeuverByTripId());
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    this.vm.onDocKey(ev);
  }
}
