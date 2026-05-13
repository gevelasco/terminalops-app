import { Component, input, model } from '@angular/core';

@Component({
  selector: 'to-textarea',
  standalone: true,
  templateUrl: './to-textarea.component.html',
  styleUrl: './to-textarea.component.scss',
})
export class ToTextareaComponent {
  readonly label = input<string>();
  readonly error = input<string>();
  readonly placeholder = input<string>();
  readonly rows = input(4);
  readonly id = input(`to-textarea-${Math.random().toString(36).slice(2, 9)}`);
  readonly disabled = input(false);
  readonly value = model('');

  onInput(ev: Event): void {
    const el = ev.target as HTMLTextAreaElement;
    this.value.set(el.value);
  }
}
