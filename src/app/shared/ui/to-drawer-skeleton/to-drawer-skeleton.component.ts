import { Component, input } from '@angular/core';

export type DrawerSkeletonVariant = 'detail' | 'form' | 'list';

@Component({
  selector: 'to-drawer-skeleton',
  standalone: true,
  templateUrl: './to-drawer-skeleton.component.html',
  styleUrl: './to-drawer-skeleton.component.scss',
})
export class ToDrawerSkeletonComponent {
  readonly variant = input<DrawerSkeletonVariant>('detail');
}
