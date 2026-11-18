import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'to-skeleton',
  standalone: true,
  templateUrl: './to-skeleton.component.html',
  styleUrl: './to-skeleton.component.scss',
})
export class ToSkeletonComponent {
  readonly lines = input(3);
  /** Altura de un bloque único (p. ej. `12rem`). Si se define, ignora `lines`. */
  readonly height = input<string | null>(null);

  readonly lineIndexes = computed(() =>
    Array.from({ length: this.lines() }, (_, i) => i),
  );

  readonly useBlock = computed(() => {
    const h = this.height()?.trim();
    return Boolean(h);
  });
}