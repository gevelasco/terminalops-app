import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-reports-tab-empty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="reports-tab-empty" [attr.aria-label]="title()">
      <h2 class="reports-tab-empty__title">{{ title() }}</h2>
      <p class="reports-tab-empty__copy">{{ description() }}</p>
      @if (bullets().length) {
        <ul class="reports-tab-empty__list">
          @for (item of bullets(); track item) {
            <li>{{ item }}</li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .reports-tab-empty {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 12rem;
      padding: 1.25rem 1.35rem;
      border-radius: var(--to-radius-lg);
      border: 1px dashed color-mix(in srgb, var(--to-color-border) 88%, transparent);
      background: color-mix(in srgb, var(--to-color-surface-muted) 70%, var(--to-color-surface));
    }

    .reports-tab-empty__title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--to-color-text);
    }

    .reports-tab-empty__copy {
      margin: 0;
      max-width: 42rem;
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--to-color-text-muted);
    }

    .reports-tab-empty__list {
      margin: 0;
      padding-left: 1.1rem;
      font-size: 0.8125rem;
      line-height: 1.55;
      color: var(--to-color-text-muted);
    }
  `,
})
export class ReportsTabEmptyComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly bullets = input<string[]>([]);
}
