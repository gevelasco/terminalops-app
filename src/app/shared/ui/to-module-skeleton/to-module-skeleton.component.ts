import { Component, computed, input } from '@angular/core';

export type ToModuleSkeletonLayout =
  | 'table'
  | 'cards'
  | 'overview-grid'
  | 'dashboard'
  | 'reports'
  | 'calendar'
  | 'map'
  | 'form'
  | 'chart';

@Component({
  selector: 'to-module-skeleton',
  standalone: true,
  templateUrl: './to-module-skeleton.component.html',
  styleUrl: './to-module-skeleton.component.scss',
})
export class ToModuleSkeletonComponent {
  readonly layout = input<ToModuleSkeletonLayout>('table');
  /** Filas de tabla / tarjetas a simular (aprox.). */
  readonly rows = input(7);

  readonly tableRowIndexes = computed(() =>
    Array.from({ length: Math.min(Math.max(this.rows(), 4), 12) }, (_, i) => i),
  );

  readonly cardIndexes = computed(() =>
    Array.from({ length: Math.min(Math.max(this.rows(), 4), 9) }, (_, i) => i),
  );

  readonly calendarWeekIndexes = computed(() => Array.from({ length: 5 }, (_, i) => i));
  readonly calendarDayIndexes = computed(() => Array.from({ length: 7 }, (_, i) => i));
}