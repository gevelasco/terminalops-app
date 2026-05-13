import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dateShort',
  standalone: true,
})
export class DateShortPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) {
      return '—';
    }
    const d = new Date(iso);
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  }
}
