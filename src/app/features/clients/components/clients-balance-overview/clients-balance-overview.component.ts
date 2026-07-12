import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ToBadgeComponent } from '@shared/ui/to-badge/to-badge.component';
import type { ClientBalanceOverviewCardView } from '@features/clients/utils/client-balance-overview-card.util';

@Component({
  selector: 'app-clients-balance-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToBadgeComponent],
  templateUrl: './clients-balance-overview.component.html',
  styleUrl: './clients-balance-overview.component.scss',
})
export class ClientsBalanceOverviewComponent {
  readonly cards = input.required<readonly ClientBalanceOverviewCardView[]>();
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
