import { Component, input } from '@angular/core';

export type ToButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ToButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'to-button',
  standalone: true,
  templateUrl: './to-button.component.html',
  styleUrl: './to-button.component.scss',
})
export class ToButtonComponent {
  readonly variant = input<ToButtonVariant>('primary');
  readonly size = input<ToButtonSize>('md');
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  /** `aria-label` en el botón nativo (el foco no está en el host). */
  readonly ariaLabel = input<string | undefined>(undefined);
}
