import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthFacade } from '@core/services/auth.facade';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ToButtonComponent, ToInputComponent],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly currentYear = new Date().getFullYear();

  onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    this.tryLogin(form);
  }

  tryLogin(form: HTMLFormElement): void {
    this.error.set(null);
    const fd = new FormData(form);
    const u = String(fd.get('username') ?? '');
    const p = String(fd.get('password') ?? '');
    this.submitting.set(true);
    const ok = this.auth.login(u, p);
    this.submitting.set(false);
    if (!ok) {
      this.error.set('Usuario o contraseña incorrectos.');
      return;
    }
    /** Entrada directa al inicio; no usar otros destinos post-login en este flujo. */
    void this.router.navigateByUrl('/dashboard');
  }
}
