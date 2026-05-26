import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder mínimo mientras carga una pestaña diferida del drawer. */
@Component({
  selector: 'to-drawer-tab-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="to-drawer-tab-placeholder"
      role="status"
      aria-label="Cargando sección"
    >
      <span class="to-drawer-tab-placeholder__bar"></span>
      <span class="to-drawer-tab-placeholder__bar to-drawer-tab-placeholder__bar--short"></span>
      <span class="to-drawer-tab-placeholder__bar to-drawer-tab-placeholder__bar--medium"></span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .to-drawer-tab-placeholder {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding: 0.25rem 0;
    }

    .to-drawer-tab-placeholder__bar {
      display: block;
      height: 0.65rem;
      border-radius: var(--to-radius-sm);
      background: linear-gradient(
        90deg,
        var(--to-color-surface-muted) 0%,
        color-mix(in srgb, var(--to-color-border) 45%, var(--to-color-surface-muted)) 50%,
        var(--to-color-surface-muted) 100%
      );
      background-size: 200% 100%;
      animation: to-drawer-tab-placeholder-shimmer 1.1s ease-in-out infinite;
    }

    .to-drawer-tab-placeholder__bar--short {
      width: 62%;
    }

    .to-drawer-tab-placeholder__bar--medium {
      width: 84%;
    }

    @keyframes to-drawer-tab-placeholder-shimmer {
      0% {
        background-position: 100% 0;
      }
      100% {
        background-position: -100% 0;
      }
    }
  `,
})
export class ToDrawerTabPlaceholderComponent {}
