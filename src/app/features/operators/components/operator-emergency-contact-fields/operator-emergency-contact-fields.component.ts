import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-operator-emergency-contact-fields',
  standalone: true,
  imports: [FormsModule, ToInputComponent, ToSelectComponent],
  templateUrl: './operator-emergency-contact-fields.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    './operator-emergency-contact-fields.component.scss',
  ],
})
export class OperatorEmergencyContactFieldsComponent {
  readonly layout = input<'new' | 'edit'>('new');
  /** `aria-labelledby` del interruptor médico (único por drawer / modo). */
  readonly medicalAuthLabelledBy = input.required<string>();
  readonly relationshipOptions = input.required<ToSelectOption[]>();

  readonly contactName = model('');
  readonly contactRelationship = model('');
  readonly contactPhone = model('');
  readonly contactEmail = model('');
  readonly authorizedMedical = model(false);

  toggleMedical(): void {
    this.authorizedMedical.update((v) => !v);
  }
}
