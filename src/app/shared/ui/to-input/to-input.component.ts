import { Component, input, model, output } from '@angular/core';

@Component({
  selector: 'to-input',
  standalone: true,
  templateUrl: './to-input.component.html',
  styleUrl: './to-input.component.scss',
})
export class ToInputComponent {
  readonly label = input<string>();
  readonly error = input<string>();
  readonly placeholder = input<string>();
  readonly id = input(`to-input-${Math.random().toString(36).slice(2, 9)}`);
  readonly type = input<
    'text' | 'number' | 'email' | 'search' | 'date' | 'datetime-local'
  >('text');
  readonly disabled = input(false);
  /** Min nativo para inputs numéricos / fecha (acepta ISO `YYYY-MM-DD`). */
  readonly min = input<string>();
  /** Max nativo para inputs numéricos / fecha. */
  readonly max = input<string>();
  readonly prefix = input<string>();
  /** Icono antes del valor (p. ej. búsqueda sin etiqueta visible). */
  readonly prefixIcon = input<'none' | 'search'>('none');
  readonly suffix = input<string>();
  /** Accesible cuando no hay `label` (p. ej. solo icono + placeholder). */
  readonly ariaLabel = input<string>();
  /**
   * Formato miles/decimales es-MX al perder foco (solo texto).
   * Usar con montos, litros, etc.
   */
  readonly groupThousands = input(false);
  readonly value = model('');

  /** Se emite al perder foco el control (tras formateo miles si aplica). */
  readonly blurNotify = output<void>();

  readonly hasAffix = () =>
    !!(
      this.prefix()?.trim() ||
      this.suffix()?.trim() ||
      this.prefixIcon() === 'search'
    );

  effectiveType(): 'text' | 'number' | 'email' | 'search' | 'date' | 'datetime-local' {
    if (this.groupThousands()) {
      return 'text';
    }
    return this.type();
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
