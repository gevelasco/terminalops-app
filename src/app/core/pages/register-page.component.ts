import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthFacade } from '@core/services/auth.facade';
import {
  SUBSCRIPTION_PLANS,
  formatPlanPriceMxn,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from '@shared/billing/subscription-plans';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

type RegisterView = 'plans' | 'checkout';

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

  readonly plans = SUBSCRIPTION_PLANS;
  readonly formatPrice = formatPlanPriceMxn;

  readonly view = signal<RegisterView>('plans');
  readonly selectedPlanId = signal<SubscriptionPlanId | null>(null);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly invitationCode = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');

  readonly currentYear = new Date().getFullYear();

  readonly selectedPlan = computed(() => {
    const id = this.selectedPlanId();
    if (!id) {
      return null;
    }
    return this.plans.find((p) => p.id === id) ?? null;
  });

  readonly showPlans = computed(() => this.view() === 'plans');
  readonly showCheckout = computed(() => this.view() === 'checkout' && !!this.selectedPlan());
  readonly showRegisterForm = computed(() => {
    const plan = this.selectedPlan();
    return this.showCheckout() && !!plan?.signupEnabled;
  });

  readonly canSubmit = computed(() => {
    const plan = this.selectedPlan();
    if (!plan?.signupEnabled || this.view() !== 'checkout') {
      return false;
    }
    if (plan.requiresInvitation && this.invitationCode().trim().length === 0) {
      return false;
    }
    return !this.submitting();
  });

  readonly passwordMismatch = computed(() => {
    const pwd = this.password();
    const confirm = this.confirmPassword();
    return confirm.length > 0 && pwd !== confirm;
  });

  selectPlan(plan: SubscriptionPlan): void {
    this.selectedPlanId.set(plan.id);
    this.error.set(null);
    this.view.set('checkout');
  }

  backToPlans(): void {
    this.view.set('plans');
    this.selectedPlanId.set(null);
    this.error.set(null);
  }

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

    const plan = this.selectedPlan();
    if (!plan?.signupEnabled) {
      this.error.set('Este plan aún no está disponible para registro.');
      return;
    }

    const fd = new FormData(form);
    const invitationCode = String(fd.get('invitationCode') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const confirmPassword = String(fd.get('confirmPassword') ?? '');

    if (plan.requiresInvitation && !invitationCode) {
      this.error.set('Debes ingresar un código de invitación para el plan Básico.');
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
