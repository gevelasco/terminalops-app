import { Component, input } from '@angular/core';

@Component({
  selector: 'to-empty-state',
  standalone: true,
  templateUrl: './to-empty-state.component.html',
  styleUrl: './to-empty-state.component.scss',
})
export class ToEmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
