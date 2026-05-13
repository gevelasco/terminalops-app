import { Component, input } from '@angular/core';

@Component({
  selector: 'to-page-header',
  standalone: true,
  templateUrl: './to-page-header.component.html',
  styleUrl: './to-page-header.component.scss',
})
export class ToPageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
