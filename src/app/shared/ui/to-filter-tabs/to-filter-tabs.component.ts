import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

export interface ToFilterTab<T extends string = string> {
  id: T;
  label: string;
  icon: ToIconName;
}

@Component({
  selector: 'to-filter-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToIconComponent],
  templateUrl: './to-filter-tabs.component.html',
  styleUrl: './to-filter-tabs.component.scss',
})
export class ToFilterTabsComponent<T extends string = string> {
  readonly tabs = input.required<readonly ToFilterTab<T>[]>();
  readonly activeId = input.required<T>();
  readonly ariaLabel = input('Filtrar');
  readonly disabled = input(false);

  readonly tabSelect = output<T>();

  onSelect(id: T): void {
    if (this.disabled()) {
      return;
    }
    this.tabSelect.emit(id);
  }
}
