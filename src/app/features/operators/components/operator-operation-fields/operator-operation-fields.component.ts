import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { OperatorOperationalStatus } from '@shared/models/logistics.models';
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
  readonly statusOptions = input.required<ToSelectOption[]>();
  readonly employmentContractOptions =
    input.required<ToSelectOption[]>();

  readonly status = model<OperatorOperationalStatus>('available');
  readonly companyHireDate = model('');
  readonly employmentContractType = model('');
}
