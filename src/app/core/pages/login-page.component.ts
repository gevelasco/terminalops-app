import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthFacade } from '@core/services/auth.facade';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToCardComponent } from '@shared/ui/to-card/to-card.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ToCardComponent, ToButtonComponent],
  template: `
    <div class="login">
      <to-card title="Acceso (stub)" subtitle="Dev: login simulado sin backend">
        <p class="login__text">
          En producción integrar OIDC / contraseña con almacenamiento seguro de sesión.
        </p>
        <div class="login__actions">
          <to-button type="button" (click)="onLogin()">Entrar (stub)</to-button>
          <to-button type="button" variant="outline" (click)="goDashboard()">
            Ir al dashboard
          </to-button>
        </div>
      </to-card>
    </div>
  `,
  styles: `
    .login {
      max-width: 420px;
      margin: 4rem auto;
      padding: 0 1rem;
    }
    .login__text {
      margin: 0 0 1rem;
      color: var(--to-color-text-muted);
      font-size: 0.875rem;
    }
    .login__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  onLogin(): void {
    this.auth.loginStub();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
    void this.router.navigateByUrl(returnUrl);
  }

  goDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }
}
