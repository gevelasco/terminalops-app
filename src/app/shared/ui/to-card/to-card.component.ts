import { Component, input } from '@angular/core';
import { KpiTitleIcon } from '@shared/models/logistics.models';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';

@Component({
  selector: 'to-card',
  standalone: true,
  imports: [ToIconComponent],
  templateUrl: './to-card.component.html',
  styleUrl: './to-card.component.scss',
})
export class ToCardComponent {
  readonly title = input<string>();
  readonly subtitle = input<string>();
  readonly titleIcon = input<KpiTitleIcon | undefined>();
}
