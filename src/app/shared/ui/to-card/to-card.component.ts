import { Component, input } from '@angular/core';
import { KpiTitleIcon } from '@shared/models/logistics.models';

@Component({
  selector: 'to-card',
  standalone: true,
  templateUrl: './to-card.component.html',
  styleUrl: './to-card.component.scss',
})
export class ToCardComponent {
  readonly title = input<string>();
  readonly subtitle = input<string>();
  readonly titleIcon = input<KpiTitleIcon | undefined>();
}
