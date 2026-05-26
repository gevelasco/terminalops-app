import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthFacade } from '@core/services/auth.facade';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ToButtonComponent, ToInputComponent, RouterLink],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly invitationCode = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');

  readonly currentYear = new Date().getFullYear();

  readonly canSubmit = computed(() => {
    return this.invitationCode().trim().length > 0 && !this.submitting();
  });

  readonly passwordMismatch = computed(() => {
    const pwd = this.password();
    const confirm = this.confirmPassword();
    return confirm.length > 0 && pwd !== confirm;
  });

  onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    this.tryRegister(form);
  }

  tryRegister(form: HTMLFormElement): void {
    this.error.set(null);

    const fd = new FormData(form);
    const invitationCode = String(fd.get('invitationCode') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const confirmPassword = String(fd.get('confirmPassword') ?? '');

    if (!invitationCode) {
      this.error.set('Debes ingresar un código de invitación para registrarte.');
      return;
    }

    if (password.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.submitting.set(true);
    this.auth
      .signUp({
        companyName: String(fd.get('companyName') ?? '').trim(),
        firstName: String(fd.get('firstName') ?? '').trim(),
        lastName: String(fd.get('lastName') ?? '').trim(),
        username: String(fd.get('username') ?? '').trim(),
        email: String(fd.get('email') ?? '').trim(),
        phone: String(fd.get('phone') ?? '').trim(),
        password,
        invitationCode,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigateByUrl('/dashboard');
        },
        error: (err) => {
          this.submitting.set(false);
          const status = err?.status as number | undefined;
          const apiMessage =
            typeof err?.error?.message === 'string'
              ? err.error.message
              : Array.isArray(err?.error?.message)
                ? err.error.message.join(' ')
                : null;
          if (status === 403) {
            this.error.set(apiMessage ?? 'Código de invitación inválido o no autorizado.');
            return;
          }
          if (status === 409) {
            this.error.set(
              apiMessage ??
                'El usuario o correo ya están registrados. Si ya te registraste, inicia sesión.',
            );
            return;
          }
          this.error.set(
            apiMessage ??
              'No se pudo completar el registro. Verifica los datos e intenta de nuevo.',
          );
        },
      });
  }
}
