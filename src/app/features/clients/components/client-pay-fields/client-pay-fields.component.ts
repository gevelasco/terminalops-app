import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { yesNoToBool } from '@features/clients/utils/client-payload';
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
  readonly paymentMethodOptions = input.required<ToSelectOption[]>();

  readonly payHasCredit = model('');
  readonly payCreditDays = model('');
  readonly payCreditAmount = model('');
  readonly payDefaultPaymentMethod = model('');

  readonly creditGranted = computed(() => yesNoToBool(this.payHasCredit()));
}
