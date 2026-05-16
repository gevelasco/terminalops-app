import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-client-fiscal-fields',
  standalone: true,
  imports: [FormsModule, ToInputComponent],
  templateUrl: './client-fiscal-fields.component.html',
  styleUrl: './client-fiscal-fields.component.scss',
})
export class ClientFiscalFieldsComponent {
  /** Alta: placeholders y rejilla responsive; edición: rejilla compacta tipo detalle. */
  readonly layout = input<'new' | 'edit'>('new');

  readonly billLegal = model('');
  readonly billRegime = model('');
  readonly billZip = model('');
  readonly billCfdi = model('');
  readonly billPhone = model('');
  readonly billEmail = model('');
}
