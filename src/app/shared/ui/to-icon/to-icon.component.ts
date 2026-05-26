import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TO_ICON_PATHS, type ToIconName } from './to-icon-paths';

@Component({
  selector: 'to-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path fill="currentColor" [attr.d]="path()" />
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class ToIconComponent {
  readonly name = input.required<ToIconName>();
  readonly size = input(18);

  readonly path = computed(() => TO_ICON_PATHS[this.name()]);
}
