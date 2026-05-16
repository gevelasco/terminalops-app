import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { OperatorLicenseType } from '@shared/models/logistics.models';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-operator-identification-fields',
  standalone: true,
  imports: [FormsModule, ToInputComponent, ToSelectComponent],
  templateUrl: './operator-identification-fields.component.html',
  styleUrl: './operator-identification-fields.component.scss',
})
export class OperatorIdentificationFieldsComponent {
  readonly layout = input<'new' | 'edit'>('new');
  readonly licenseTypeOptions = input.required<ToSelectOption[]>();

  readonly fullName = model('');
  readonly birthDate = model('');
  readonly curp = model('');
  readonly rfc = model('');
  readonly licenseNumber = model('');
  readonly licenseExpiresOn = model('');
  readonly licenseType = model<OperatorLicenseType>('unspecified');
  readonly licenseEndorsements = model('');
  readonly phone = model('');
  readonly phoneSecondary = model('');
  readonly address = model('');
}
