import { Component, input } from '@angular/core';

export type ToBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

@Component({
  selector: 'to-badge',
  standalone: true,
  templateUrl: './to-badge.component.html',
  styleUrl: './to-badge.component.scss',
})
export class ToBadgeComponent {
  readonly variant = input<ToBadgeVariant>('neutral');
}
