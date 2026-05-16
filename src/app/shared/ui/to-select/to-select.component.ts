import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ToSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'to-select',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './to-select.component.html',
  styleUrl: './to-select.component.scss',
})
export class ToSelectComponent {
  readonly label = input<string>();
  readonly error = input<string>();
  /** Texto inicial cuando no hay valor; no aparece como opción elegible en la lista. */
  readonly placeholder = input<string>('');
  readonly options = input<ToSelectOption[]>([]);
  readonly id = input(`to-select-${Math.random().toString(36).slice(2, 9)}`);
  readonly disabled = input(false);
  readonly value = model('');

  readonly blurNotify = output<void>();
}
