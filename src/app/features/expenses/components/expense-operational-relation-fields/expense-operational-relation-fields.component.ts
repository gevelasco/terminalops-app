import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EXPENSE_VERIFICATION_SCOPE_OPTIONS,
} from '@shared/catalogs/expense-form-options';
import {
  EXPENSE_OPERATIONAL_RELATION_TABS,
  expenseRelationEquipmentHint,
  expenseRelationOperatorHint,
  expenseRelationTripHint,
  expenseRelationUnitHint,
  type ExpenseOperationalRelationTab,
} from '@features/expenses/utils/expense-operational-relation.util';
import { expenseManeuverCode } from '@features/expenses/utils/expense-row-labels';
import type {
  Expense,
  ExpenseKind,
  ExpenseVerificationScope,
} from '@shared/models/logistics.models';
import {
  ToFilterTabsComponent,
} from '@shared/ui/to-filter-tabs/to-filter-tabs.component';
import {
  ToSelectComponent,
} from '@shared/ui/to-select/to-select.component';
import { ToTripInputComponent } from '@shared/ui/to-trip-input/to-trip-input.component';
import { ToFleetResourceLinkInputComponent } from '@shared/ui/to-fleet-resource-link-input/to-fleet-resource-link-input.component';
import { ToOperatorLinkInputComponent } from '@shared/ui/to-operator-link-input/to-operator-link-input.component';
import type { ExpenseRubro } from '@features/expenses/utils/expense-rubro.util';

@Component({
  selector: 'app-expense-operational-relation-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ToFilterTabsComponent,
    ToSelectComponent,
    ToTripInputComponent,
    ToFleetResourceLinkInputComponent,
    ToOperatorLinkInputComponent,
  ],
  templateUrl: './expense-operational-relation-fields.component.html',
  styleUrl: './expense-operational-relation-fields.component.scss',
})
export class ExpenseOperationalRelationFieldsComponent {
  readonly mode = input<'edit' | 'read'>('edit');
  readonly rubro = input<ExpenseRubro>('gasto');
  readonly kind = input<ExpenseKind>('other');
  readonly expense = input<Expense | null>(null);
  readonly tripManeuverByTripId =
    input<ReadonlyMap<string, string> | undefined>(undefined);

  readonly relationTab = model<ExpenseOperationalRelationTab>('trip');
  readonly tripId = model('');
  readonly relatedUnitId = model('');
  readonly relatedEquipmentId = model('');
  readonly relatedOperatorId = model('');
  readonly verificationScope = model<ExpenseVerificationScope>('phys_mech');

  readonly relationTabs = EXPENSE_OPERATIONAL_RELATION_TABS;
  readonly verificationScopeOptions = EXPENSE_VERIFICATION_SCOPE_OPTIONS;

  readonly isManiobraRubro = computed(() => this.rubro() === 'maniobra');

  readonly tripHint = computed(() =>
    expenseRelationTripHint(this.isManiobraRubro()),
  );
  readonly unitHint = computed(() => expenseRelationUnitHint(this.kind()));
  readonly equipmentHint = computed(() =>
    expenseRelationEquipmentHint(this.kind()),
  );
  readonly operatorHint = computed(() =>
    expenseRelationOperatorHint(this.kind()),
  );

  readonly showVerificationScope = computed(
    () => this.kind() === 'verification',
  );

  readonly tripDisplayLabel = computed(() => {
    const e = this.expense();
    if (e?.tripManeuverCode?.trim()) {
      return e.tripManeuverCode.trim();
    }
    const tid = this.tripId().trim();
    if (!tid) {
      return '';
    }
    return this.tripManeuverByTripId()?.get(tid)?.trim() || '';
  });

  readonly fleetRelationDisplayLabel = computed(() =>
    this.expense()?.fleetRelationLabel?.trim() || '',
  );

  readonly maneuverCode = computed(() => {
    if (this.mode() === 'read') {
      const e = this.expense();
      return e ? expenseManeuverCode(e, this.tripManeuverByTripId()) : '—';
    }
    const tid = this.tripId().trim();
    if (!tid) {
      return '—';
    }
    return this.tripManeuverByTripId()?.get(tid)?.trim() || '—';
  });

  readonly unitLabel = computed(() =>
    this.relationFieldLabel('unit', this.expense()?.relatedUnitLabel),
  );
  readonly equipmentLabel = computed(() =>
    this.relationFieldLabel('equipment', this.expense()?.relatedEquipmentLabel),
  );
  readonly operatorLabel = computed(() =>
    this.relationFieldLabel('operator', this.expense()?.relatedOperatorLabel),
  );

  readonly verificationTypeLabel = computed(() => {
    const scope =
      this.mode() === 'read'
        ? this.expense()?.verificationScope
        : this.verificationScope();
    if (!scope) {
      return '—';
    }
    return (
      EXPENSE_VERIFICATION_SCOPE_OPTIONS.find((o) => o.value === scope)
        ?.label ?? scope
    );
  });

  onTabSelect(tab: ExpenseOperationalRelationTab): void {
    this.relationTab.set(tab);
  }

  private readUnitId(): string {
    if (this.mode() === 'read') {
      return this.expense()?.relatedUnitId?.trim() || '';
    }
    return this.relatedUnitId().trim();
  }

  private readEquipmentId(): string {
    if (this.mode() === 'read') {
      return this.expense()?.relatedEquipmentId?.trim() || '';
    }
    return this.relatedEquipmentId().trim();
  }

  private readOperatorId(): string {
    if (this.mode() === 'read') {
      return this.expense()?.relatedOperatorId?.trim() || '';
    }
    return this.relatedOperatorId().trim();
  }

  private relationFieldLabel(
    field: 'unit' | 'equipment' | 'operator',
    apiLabel: string | undefined,
  ): string {
    const id =
      field === 'unit'
        ? this.readUnitId()
        : field === 'equipment'
          ? this.readEquipmentId()
          : this.readOperatorId();
    if (!id) {
      return '—';
    }
    if (this.mode() === 'read') {
      return apiLabel?.trim() || id;
    }
    return this.fleetRelationDisplayLabel() || id;
  }
}
