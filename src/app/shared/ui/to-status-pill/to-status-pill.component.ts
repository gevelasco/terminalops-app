import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'to-status-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './to-status-pill.component.html',
  styleUrl: './to-status-pill.component.scss',
})
export class ToStatusPillComponent {
  readonly label = input.required<string>();
  readonly sub = input<string | undefined>(undefined);
  /** Clase modificadora BEM (p. ej. `to-status-pill--available`). */
  readonly modClass = input('');
  readonly showDot = input(true);
}
