import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ToDerivedWandIconComponent } from '../to-derived-wand-icon/to-derived-wand-icon.component';

export type ToDisplayFieldVariant = 'plain' | 'boxed' | 'metric';

/** none = sin indicador; pending = esperando cálculo; ready = valor derivado listo */
export type ToDisplayDerivedState = 'none' | 'pending' | 'ready';

@Component({
  selector: 'to-display-field',
  standalone: true,
  imports: [ToDerivedWandIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './to-display-field.component.html',
  styleUrl: './to-display-field.component.scss',
})
export class ToDisplayFieldComponent {
  readonly label = input<string>('');
  readonly value = input<string>('');
  readonly placeholder = input<string>('—');
  readonly variant = input<ToDisplayFieldVariant>('plain');
  readonly derived = input<ToDisplayDerivedState>('none');

  readonly resolvedValue = computed(() => this.value().trim());
  readonly showDerived = computed(() => this.derived() !== 'none');
}
