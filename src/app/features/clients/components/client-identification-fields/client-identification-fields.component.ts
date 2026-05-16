import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';

@Component({
  selector: 'app-client-identification-fields',
  standalone: true,
  imports: [FormsModule, ToInputComponent, ToTextareaComponent],
  templateUrl: './client-identification-fields.component.html',
  styleUrl: './client-identification-fields.component.scss',
})
export class ClientIdentificationFieldsComponent {
  readonly layout = input<'new' | 'edit'>('new');
  /** Solo en detalle: aviso al editar el nombre comercial. */
  readonly showRenameHint = input(false);

  readonly clientName = model('');
  readonly rfc = model('');
  readonly relationshipStartedOn = model('');
  readonly notes = model('');
}
