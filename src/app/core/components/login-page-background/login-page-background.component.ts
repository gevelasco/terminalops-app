import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LoginLogisticsVizComponent } from '@core/components/login-logistics-viz/login-logistics-viz.component';

@Component({
  selector: 'app-login-page-background',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoginLogisticsVizComponent],
  template: `<app-login-logistics-viz />`,
  styles: `
    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
      background: #131c2b;
    }
  `,
})
export class LoginPageBackgroundComponent {}
