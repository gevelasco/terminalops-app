import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/services/api/auth';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [ToButtonComponent, ToInputComponent, RouterLink],
  templateUrl: './forgot-password-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class ForgotPasswordPageComponent {
  private readonly authApi = inject(AuthService);

  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  readonly submitting = signal(false);
  readonly currentYear = new Date().getFullYear();

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
    this.success.set(false);
    const email = String(new FormData(form).get('email') ?? '').trim();
    if (!email) {
      this.error.set('Indica tu correo electrónico.');
      return;
    }
    this.submitting.set(true);
    try {
      await firstValueFrom(this.authApi.forgotPassword(email));
      this.success.set(true);
    } catch {
      this.error.set('No se pudo enviar el correo. Intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }
}
