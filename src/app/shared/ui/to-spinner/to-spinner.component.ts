import { Component, input } from '@angular/core';

@Component({
  selector: 'to-spinner',
  standalone: true,
  templateUrl: './to-spinner.component.html',
  styleUrl: './to-spinner.component.scss',
})
export class ToSpinnerComponent {
  readonly label = input('Cargando…');
  readonly size = input<'sm' | 'md'>('md');
}
