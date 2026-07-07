import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-operator-operation-fields',
  standalone: true,
  imports: [FormsModule, ToInputComponent, ToSelectComponent],
  templateUrl: './operator-operation-fields.component.html',
  styleUrl: './operator-operation-fields.component.scss',
})
export class OperatorOperationFieldsComponent {
  readonly layout = input<'new' | 'edit'>('new');
  readonly employmentContractOptions =
    input.required<ToSelectOption[]>();
  readonly paymentScheduleOptions = input.required<ToSelectOption[]>();
  readonly paymentMethodOptions = input.required<ToSelectOption[]>();
  readonly visibilityOptions = input<ToSelectOption[]>([]);

  readonly companyHireDate = model('');
  readonly employmentContractType = model('');
  readonly paymentSchedule = model('maneuver');
  readonly paymentMethod = model('');
  readonly visibility = model('');
}
