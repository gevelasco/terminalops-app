import { Component, input } from '@angular/core';
import { ToButtonSize } from '../to-button/to-button.component';

@Component({
  selector: 'to-icon-button',
  standalone: true,
  templateUrl: './to-icon-button.component.html',
  styleUrl: './to-icon-button.component.scss',
})
export class ToIconButtonComponent {
  readonly label = input.required<string>();
  readonly size = input<ToButtonSize>('md');
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
}
