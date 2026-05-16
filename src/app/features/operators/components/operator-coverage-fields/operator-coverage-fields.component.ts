import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { OperatorInsuranceKind } from '@shared/models/logistics.models';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';

@Component({
  selector: 'app-operator-coverage-fields',
  standalone: true,
  imports: [FormsModule, ToInputComponent, ToSelectComponent, ToTextareaComponent],
  templateUrl: './operator-coverage-fields.component.html',
  styleUrl: './operator-coverage-fields.component.scss',
})
export class OperatorCoverageFieldsComponent {
  readonly layout = input<'new' | 'edit'>('new');
  readonly insuranceKindOptions = input.required<ToSelectOption[]>();
  readonly premiumPeriodOptions = input.required<ToSelectOption[]>();

  readonly insuranceKind = model<OperatorInsuranceKind>('none');

  readonly pubNss = model('');
  readonly pubImssAlta = model('');
  readonly pubInfonavit = model(false);
  readonly pubInfonavitCredit = model('');
  readonly pubFonacot = model(false);
  readonly pubFonacotCredit = model('');
  readonly pubNotes = model('');

  readonly privCarrier = model('');
  readonly privPolicy = model('');
  readonly privValidFrom = model('');
  readonly privValidTo = model('');
  readonly privPremium = model('');
  readonly privPremiumPeriod = model('');
  readonly privDeductible = model('');
  readonly privPlan = model('');

  readonly infonavitToggleLabelId = input.required<string>();
  readonly fonacotToggleLabelId = input.required<string>();

  toggleInfonavit(): void {
    this.pubInfonavit.update((v) => !v);
  }

  toggleFonacot(): void {
    this.pubFonacot.update((v) => !v);
  }
}
