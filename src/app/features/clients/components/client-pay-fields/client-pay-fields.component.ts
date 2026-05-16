import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-client-pay-fields',
  standalone: true,
  imports: [FormsModule, ToInputComponent, ToSelectComponent],
  templateUrl: './client-pay-fields.component.html',
  styleUrl: './client-pay-fields.component.scss',
})
export class ClientPayFieldsComponent {
  readonly layout = input<'new' | 'edit'>('new');
  readonly yesNoOptions = input.required<ToSelectOption[]>();
  readonly healthOptions = input.required<ToSelectOption[]>();

  readonly payHasCredit = model('');
  readonly payCreditDays = model('');
  readonly payCreditAmount = model('');
  readonly payHealth = model('');
}
