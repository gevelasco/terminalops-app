import { Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-client-contact-inline-fields',
  standalone: true,
  imports: [FormsModule, ToInputComponent],
  templateUrl: './client-contact-inline-fields.component.html',
  styleUrl: './client-contact-inline-fields.component.scss',
})
export class ClientContactInlineFieldsComponent {
  readonly contactName = model('');
  readonly contactRole = model('');
  readonly contactPhone = model('');
  readonly contactEmail = model('');
}
