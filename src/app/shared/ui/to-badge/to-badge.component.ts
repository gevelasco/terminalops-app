import { Component, input } from '@angular/core';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

export type ToBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

@Component({
  selector: 'to-badge',
  standalone: true,
  imports: [ToIconComponent],
  templateUrl: './to-badge.component.html',
  styleUrl: './to-badge.component.scss',
})
export class ToBadgeComponent {
  readonly variant = input<ToBadgeVariant>('neutral');
  readonly icon = input<ToIconName | null>(null);
}
