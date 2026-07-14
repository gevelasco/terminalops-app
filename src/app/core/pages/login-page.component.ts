import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthFacade } from '@core/services/auth.facade';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ToButtonComponent, ToInputComponent, RouterLink],
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
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    if (!email || !password) {
      this.error.set('Indica correo y contraseña.');
      return;
    }
    this.submitting.set(true);
    this.auth.login(email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl('/dashboard');
      },
      error: () => {
        this.submitting.set(false);
        this.error.set('Correo o contraseña incorrectos.');
      },
    });
  }
}
