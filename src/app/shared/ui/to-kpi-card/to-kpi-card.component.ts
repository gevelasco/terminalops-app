import { Component, input } from '@angular/core';
import type { KpiTitleIcon } from '@shared/models/logistics.models';
import { ToCardComponent } from '@shared/ui/to-card/to-card.component';

export type ToKpiCardDeltaTone = 'up' | 'down' | 'neutral';

@Component({
  selector: 'to-kpi-card',
  standalone: true,
  imports: [ToCardComponent],
  templateUrl: './to-kpi-card.component.html',
  styleUrl: './to-kpi-card.component.scss',
})
export class ToKpiCardComponent {
  readonly title = input.required<string>();
  readonly titleIcon = input<KpiTitleIcon>();
  readonly value = input.required<string>();
  readonly legend = input<string>();
  readonly deltaLabel = input<string>();
  readonly deltaTone = input<ToKpiCardDeltaTone>();
}
