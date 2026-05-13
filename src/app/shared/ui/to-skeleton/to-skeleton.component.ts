import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'to-skeleton',
  standalone: true,
  templateUrl: './to-skeleton.component.html',
  styleUrl: './to-skeleton.component.scss',
})
export class ToSkeletonComponent {
  readonly lines = input(3);

  readonly lineIndexes = computed(() =>
    Array.from({ length: this.lines() }, (_, i) => i),
  );
}
