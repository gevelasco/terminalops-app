import { Component, computed, input, model, output, signal } from '@angular/core';
import { ToDerivedWandIconComponent } from '../to-derived-wand-icon/to-derived-wand-icon.component';

@Component({
  selector: 'to-input',
  standalone: true,
  imports: [ToDerivedWandIconComponent],
  templateUrl: './to-input.component.html',
  styleUrl: './to-input.component.scss',
})
export class ToInputComponent {
  readonly label = input<string>();
  readonly error = input<string>();
  readonly placeholder = input<string>();
  readonly id = input(`to-input-${Math.random().toString(36).slice(2, 9)}`);
  readonly type = input<
    'text' | 'number' | 'email' | 'search' | 'password' | 'date' | 'datetime-local' | 'url'
  >('text');
  readonly disabled = input(false);
  /** Nombre del control para `FormData` / envío de formularios. */
  readonly inputName = input<string>();
  /** Min nativo para inputs numéricos / fecha (acepta ISO `YYYY-MM-DD`). */
  readonly min = input<string>();
  /** Max nativo para inputs numéricos / fecha. */
  readonly max = input<string>();
  /** Longitud máxima del valor (p. ej. CP de 5 dígitos). */
  readonly maxLength = input<number | null>(null);
  readonly prefix = input<string>();
  /** Icono antes del valor. */
  readonly prefixIcon = input<'none' | 'search' | 'user' | 'lock'>('none');
  /** Indicador sparkle: pending = gris; ready = primario (autocalculado). */
  readonly derivedState = input<'none' | 'pending' | 'ready'>('none');
  readonly suffix = input<string>();
  /**
   * Si es `true` y `type` es `password`, muestra botón para alternar visibilidad.
   */
  readonly passwordToggle = input(false);
  /** Accesible cuando no hay `label` (p. ej. solo icono + placeholder). */
  readonly ariaLabel = input<string>();
  /** Valor nativo `autocomplete` del control (p. ej. `username`, `current-password`). */
  readonly autocomplete = input<string>();
  /**
   * Formato miles/decimales es-MX al perder foco (solo texto).
   * Usar con montos, litros, etc.
   */
  readonly groupThousands = input(false);
  readonly value = model('');

  /**
   * Texto mostrado en el `<input>` cuando el padre lo enlaza (p. ej. solo lectura
   * con `[displayValue]="computed()"`). Evita que el valor quede desincronizado
   * respecto al `model()` cuando solo hay binding unidireccional.
   */
  readonly displayValue = input<string | undefined>(undefined);

  readonly shownInputValue = computed(() => {
    const fromParent = this.displayValue();
    return fromParent !== undefined ? fromParent : this.value();
  });

  /** Se emite al perder foco el control (tras formateo miles si aplica). */
  readonly blurNotify = output<void>();

  /** Contraseña visible como texto (solo con `passwordToggle`). */
  readonly passwordVisible = signal(false);

  readonly hasAffix = () =>
    !!(
      this.prefix()?.trim() ||
      this.suffix()?.trim() ||
      this.prefixIcon() !== 'none' ||
      this.derivedState() !== 'none' ||
      this.showPasswordReveal()
    );

  showPasswordReveal(): boolean {
    return this.type() === 'password' && this.passwordToggle();
  }

  effectiveType():
    | 'text'
    | 'number'
    | 'email'
    | 'search'
    | 'password'
    | 'date'
    | 'datetime-local'
    | 'url' {
    if (this.groupThousands()) {
      return 'text';
    }
    if (this.type() === 'password' && this.passwordToggle() && this.passwordVisible()) {
      return 'text';
    }
    return this.type();
  }

  togglePasswordVisible(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.passwordVisible.update((v) => !v);
  }

  onInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.value.set(el.value);
  }

  onBlur(): void {
    if (this.groupThousands()) {
      const raw = this.value().trim();
      if (raw !== '') {
        const n = this.parseGroupedNumber(raw);
        if (n !== null) {
          this.value.set(this.formatEsMxNumber(n));
        }
      }
    }
    this.blurNotify.emit();
  }

  private parseGroupedNumber(s: string): number | null {
    let t = s.replace(/\s/g, '').replace(/,/g, '');
    if (t === '') {
      return null;
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  private formatEsMxNumber(n: number): string {
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);
  }
}
