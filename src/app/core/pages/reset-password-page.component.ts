import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/services/api/auth';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ToButtonComponent, ToInputComponent, RouterLink],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class ResetPasswordPageComponent {
  private readonly authApi = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = signal('');
  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  readonly submitting = signal(false);
  readonly currentYear = new Date().getFullYear();

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
    this.token.set(token);
    if (!token) {
      this.error.set('El enlace no es válido. Solicita uno nuevo desde el login.');
    }
  }

  onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    void this.trySubmit(form);
  }

  async trySubmit(form: HTMLFormElement): Promise<void> {
    this.error.set(null);
    const token = this.token();
    if (!token) {
      this.error.set('El enlace no es válido. Solicita uno nuevo desde el login.');
      return;
    }
    const fd = new FormData(form);
    const password = String(fd.get('password') ?? '');
    const confirm = String(fd.get('confirmPassword') ?? '');
    if (password.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.submitting.set(true);
    try {
      await firstValueFrom(this.authApi.resetPassword(token, password));
      this.success.set(true);
      setTimeout(() => {
        void this.router.navigateByUrl('/login');
      }, 1500);
    } catch {
      this.error.set(
        'No se pudo restablecer. El enlace pudo caducar; solicita uno nuevo.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
