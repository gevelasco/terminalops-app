import { Component, inject } from '@angular/core';
import { ToastService, ToastVariant } from './toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.scss',
})
export class ToastHostComponent {
  readonly toast = inject(ToastService);

  variantClass(v: ToastVariant): string {
    const base = 'toast-host__item';
    return `${base} ${base}--${v}`;
  }

  titleFor(v: ToastVariant): string {
    const titles: Record<ToastVariant, string> = {
      info: 'Información',
      success: 'Exitoso',
      warning: 'Advertencia',
      error: 'Error',
    };
    return titles[v];
  }
}
