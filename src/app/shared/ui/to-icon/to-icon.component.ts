import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  TO_ICON_FILL_RULE,
  TO_ICON_PATHS,
  TO_ICON_STROKE,
  TO_ICON_VIEWBOX,
  type ToIconFillName,
  type ToIconName,
} from './to-icon-paths';

@Component({
  selector: 'to-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="to-icon__svg"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.viewBox]="iconViewBox()"
      aria-hidden="true"
    >
      @if (strokeIcon(); as stroke) {
        @for (layer of stroke.paths; track layer.d) {
          <path
            [attr.d]="layer.d"
            fill="none"
            stroke="currentColor"
            [attr.stroke-width]="stroke.strokeWidth"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        }
      } @else {
        <path
          fill="currentColor"
          [attr.fill-rule]="fillRule()"
          [attr.d]="fillPath()"
        />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      flex-shrink: 0;
    }

    .to-icon__svg {
      display: block;
      vertical-align: middle;
    }
  `,
})
export class ToIconComponent {
  readonly name = input.required<ToIconName>();
  readonly size = input(18);

  readonly strokeIcon = computed(() => {
    const key = this.name();
    return key in TO_ICON_STROKE
      ? TO_ICON_STROKE[key as keyof typeof TO_ICON_STROKE]
      : null;
  });

  readonly fillPath = computed(() => TO_ICON_PATHS[this.name() as ToIconFillName]);
  readonly iconViewBox = computed(
    () => TO_ICON_VIEWBOX[this.name() as ToIconFillName] ?? '0 0 24 24',
  );
  readonly fillRule = computed(
    () => TO_ICON_FILL_RULE[this.name() as ToIconFillName] ?? 'nonzero',
  );
}
