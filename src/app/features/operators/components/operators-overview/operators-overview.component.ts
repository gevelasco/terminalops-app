import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ToBadgeComponent } from '@shared/ui/to-badge/to-badge.component';
import type { OperatorsOverviewCardView } from '@features/operators/utils/operators-overview-card';

@Component({
  selector: 'app-operators-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToBadgeComponent],
  templateUrl: './operators-overview.component.html',
  styleUrl: './operators-overview.component.scss',
})
export class OperatorsOverviewComponent {
  readonly cards = input.required<readonly OperatorsOverviewCardView[]>();
  readonly cardSelect = output<string>();

  readonly hasCards = computed(() => this.cards().length > 0);

  onCardClick(id: string): void {
    this.cardSelect.emit(id);
  }

  onCardKeydown(ev: KeyboardEvent, id: string): void {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.onCardClick(id);
    }
  }
}
