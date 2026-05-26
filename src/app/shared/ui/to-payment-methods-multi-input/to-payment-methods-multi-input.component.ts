import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import type { ReportsTripPaymentMethod } from '@features/reports/models/reports-view.models';
import { TRIP_CLIENT_PAYMENT_METHOD_OPTIONS } from '@shared/catalogs/trip-client-payment-options';

let paymentMethodsMultiSeq = 0;

@Component({
  selector: 'to-payment-methods-multi-input',
  standalone: true,
  templateUrl: './to-payment-methods-multi-input.component.html',
  styleUrl: './to-payment-methods-multi-input.component.scss',
})
export class ToPaymentMethodsMultiInputComponent {
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  readonly placeholder = input('Forma de cobro');
  readonly disabled = input(false);

  readonly methods = model<ReportsTripPaymentMethod[]>([]);

  readonly inputId = `to-payment-methods-multi-${++paymentMethodsMultiSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly open = signal(false);

  readonly options = TRIP_CLIENT_PAYMENT_METHOD_OPTIONS;

  readonly selectedOptions = computed(() => {
    const selected = new Set(this.methods());
    return TRIP_CLIENT_PAYMENT_METHOD_OPTIONS.filter((opt) =>
      selected.has(opt.value as ReportsTripPaymentMethod),
    );
  });

  isSelected(value: string): boolean {
    return this.methods().includes(value as ReportsTripPaymentMethod);
  }

  toggleOpen(event: Event): void {
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    this.open.update((v) => !v);
  }

  onTogglePointerDown(value: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    const method = value as ReportsTripPaymentMethod;
    this.methods.update((current) => {
      if (current.includes(method)) {
        return current.filter((m) => m !== method);
      }
      return [...current, method];
    });
  }

  removeMethod(value: string, event: Event): void {
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    const method = value as ReportsTripPaymentMethod;
    this.methods.update((current) => current.filter((m) => m !== method));
  }

  clearAll(event: Event): void {
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    this.methods.set([]);
    this.open.set(false);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.hostEl.nativeElement.contains(target)) {
      this.open.set(false);
    }
  }
}
