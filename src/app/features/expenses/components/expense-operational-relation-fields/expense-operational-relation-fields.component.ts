import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TripsService } from '@services/api/trips';
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
import {
  expenseRelationsFromTrip,
  mergeTripExpenseRelations,
  tripEquipmentDisplayLabel,
  tripOperatorDisplayLabel,
  tripUnitDisplayLabel,
} from '@features/expenses/utils/expense-trip-relations.util';
import type {
  Expense,
  ExpenseKind,
  ExpenseVerificationScope,
  Trip,
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
  styleUrls: [
    './expense-operational-relation-fields.component.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
  ],
})
export class ExpenseOperationalRelationFieldsComponent {
  private readonly tripsApi = inject(TripsService);

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

  private readonly linkedTrip = signal<Trip | null>(null);
  private appliedTripId = '';

  private readonly linkedTripId = computed(() => {
    if (this.mode() === 'read') {
      return this.expense()?.tripId?.trim() || '';
    }
    return this.tripId().trim();
  });

  constructor() {
    effect((onCleanup) => {
      const tripId = this.linkedTripId();
      if (!tripId) {
        this.linkedTrip.set(null);
        this.appliedTripId = '';
        return;
      }

      let cancelled = false;
      const sub = this.tripsApi
        .getTripById(tripId, { view: 'expense-relations' })
        .subscribe({
          next: (trip) => {
            if (cancelled || !trip) {
              return;
            }
            this.linkedTrip.set(trip);
            if (this.mode() === 'edit') {
              untracked(() => this.applyTripRelations(trip, tripId));
            }
          },
          error: () => {
            if (!cancelled) {
              this.linkedTrip.set(null);
            }
          },
        });
      onCleanup(() => {
        cancelled = true;
        sub.unsubscribe();
      });
    });
  }

  readonly tripDisplayLabel = computed(() => {
    const e = this.expense();
    if (e?.tripManeuverCode?.trim()) {
      return e.tripManeuverCode.trim();
    }
    const fromTrip = this.linkedTrip()?.maneuverCode?.trim();
    if (fromTrip) {
      return fromTrip;
    }
    const tid = this.tripId().trim();
    if (!tid) {
      return '';
    }
    return this.tripManeuverByTripId()?.get(tid)?.trim() || '';
  });

  readonly unitDisplayLabel = computed(
    () =>
      this.expense()?.relatedUnitLabel?.trim() ||
      tripUnitDisplayLabel(this.linkedTrip()) ||
      this.expense()?.fleetRelationLabel?.trim() ||
      '',
  );
  readonly equipmentDisplayLabel = computed(
    () =>
      this.expense()?.relatedEquipmentLabel?.trim() ||
      tripEquipmentDisplayLabel(this.linkedTrip()) ||
      '',
  );
  readonly operatorDisplayLabel = computed(
    () =>
      this.expense()?.relatedOperatorLabel?.trim() ||
      tripOperatorDisplayLabel(this.linkedTrip()) ||
      '',
  );

  readonly maneuverCode = computed(() => {
    if (this.mode() === 'read') {
      const e = this.expense();
      const fromExpense = e
        ? expenseManeuverCode(e, this.tripManeuverByTripId())
        : '—';
      if (fromExpense !== '—') {
        return fromExpense;
      }
      return this.linkedTrip()?.maneuverCode?.trim() || '—';
    }
    const tid = this.tripId().trim();
    if (!tid) {
      return '—';
    }
    return (
      this.linkedTrip()?.maneuverCode?.trim() ||
      this.tripManeuverByTripId()?.get(tid)?.trim() ||
      '—'
    );
  });

  readonly unitLabel = computed(() =>
    this.relationFieldLabel(
      'unit',
      this.expense()?.relatedUnitLabel,
      tripUnitDisplayLabel(this.linkedTrip()),
    ),
  );
  readonly equipmentLabel = computed(() =>
    this.relationFieldLabel(
      'equipment',
      this.expense()?.relatedEquipmentLabel,
      tripEquipmentDisplayLabel(this.linkedTrip()),
    ),
  );
  readonly operatorLabel = computed(() =>
    this.relationFieldLabel(
      'operator',
      this.expense()?.relatedOperatorLabel,
      tripOperatorDisplayLabel(this.linkedTrip()),
    ),
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

  private applyTripRelations(trip: Trip, tripId: string): void {
    const overwrite =
      this.appliedTripId !== '' && this.appliedTripId !== tripId;
    this.appliedTripId = tripId;
    const next = mergeTripExpenseRelations(
      {
        relatedUnitId: this.relatedUnitId(),
        relatedEquipmentId: this.relatedEquipmentId(),
        relatedOperatorId: this.relatedOperatorId(),
      },
      expenseRelationsFromTrip(this.kind(), trip),
      overwrite ? 'overwrite' : 'fill-empty',
    );
    this.relatedUnitId.set(next.relatedUnitId);
    this.relatedEquipmentId.set(next.relatedEquipmentId);
    this.relatedOperatorId.set(next.relatedOperatorId);
  }

  private readUnitId(): string {
    if (this.mode() === 'read') {
      return (
        this.expense()?.relatedUnitId?.trim() ||
        this.linkedTrip()?.unitId?.trim() ||
        ''
      );
    }
    return this.relatedUnitId().trim();
  }

  private readEquipmentId(): string {
    if (this.mode() === 'read') {
      return (
        this.expense()?.relatedEquipmentId?.trim() ||
        this.linkedTrip()?.equipmentIds?.[0]?.trim() ||
        ''
      );
    }
    return this.relatedEquipmentId().trim();
  }

  private readOperatorId(): string {
    if (this.mode() === 'read') {
      return (
        this.expense()?.relatedOperatorId?.trim() ||
        this.linkedTrip()?.operatorId?.trim() ||
        ''
      );
    }
    return this.relatedOperatorId().trim();
  }

  private relationFieldLabel(
    field: 'unit' | 'equipment' | 'operator',
    apiLabel: string | undefined,
    tripLabel: string,
  ): string {
    const id =
      field === 'unit'
        ? this.readUnitId()
        : field === 'equipment'
          ? this.readEquipmentId()
          : this.readOperatorId();
    if (!id && !tripLabel) {
      return '—';
    }
    if (this.mode() === 'read') {
      return apiLabel?.trim() || tripLabel || id || '—';
    }
    return (
      (field === 'unit'
        ? this.unitDisplayLabel()
        : field === 'equipment'
          ? this.equipmentDisplayLabel()
          : this.operatorDisplayLabel()) ||
      id ||
      '—'
    );
  }
}
