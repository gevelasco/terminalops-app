import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyMx',
  standalone: true,
})
export class CurrencyMxPipe implements PipeTransform {
  transform(value: number | null | undefined, currency = 'MXN'): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
