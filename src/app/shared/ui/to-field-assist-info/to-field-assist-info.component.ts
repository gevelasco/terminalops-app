import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { assistCalcTooltip } from '@shared/catalogs/assist-calc-tooltips';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';

@Component({
  selector: 'to-field-assist-info',
  standalone: true,
  imports: [ToIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #trigger
      type="button"
      class="to-field-assist-info"
      [class.to-field-assist-info--auto]="auto()"
      [attr.aria-label]="resolvedTooltip()"
      (mouseenter)="show()"
      (mouseleave)="hide()"
      (focus)="show()"
      (blur)="hide()"
    >
      <to-icon name="info" [size]="14" />
    </button>
    @if (visible()) {
      <span
        class="to-field-assist-info__bubble"
        [style.left.px]="pos().x"
        [style.top.px]="pos().y"
        role="tooltip"
      >
        {{ resolvedTooltip() }}
      </span>
    }
  `,
  styleUrl: './to-field-assist-info.component.scss',
  host: {
    class: 'to-field-assist-info-host',
  },
})
export class ToFieldAssistInfoComponent {
  readonly auto = input(false);
  readonly tooltip = input<string | undefined>(undefined);

  private readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');

  readonly visible = signal(false);
  readonly pos = signal({ x: 0, y: 0 });

  resolvedTooltip(): string {
    const custom = this.tooltip()?.trim();
    if (custom) {
      return custom;
    }
    return assistCalcTooltip(this.auto());
  }

  show(): void {
    const el = this.trigger()?.nativeElement;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    this.pos.set({
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
    });
    this.visible.set(true);
  }

  hide(): void {
    this.visible.set(false);
  }
}
