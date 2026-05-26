import { DOCUMENT, NgClass } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import type { DrawerSkeletonVariant } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';

@Component({
  selector: 'to-side-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, ToDrawerSkeletonComponent, ToIconButtonComponent, ToIconComponent],
  templateUrl: './to-side-drawer.component.html',
  styleUrl: './to-side-drawer.component.scss',
})
export class ToSideDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** `id` del título para `aria-labelledby`. */
  readonly titleId = input('');
  readonly wide = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly skeletonVariant = input<DrawerSkeletonVariant>('detail');
  readonly formMode = input(false, { transform: booleanAttribute });
  readonly lockScroll = input(true, { transform: booleanAttribute });
  readonly panelClass = input('');
  readonly bodyClass = input('');
  readonly headerClass = input('');

  readonly dismiss = output<void>();
  readonly formSubmit = output<void>();

  constructor() {
    if (this.lockScroll()) {
      this.doc.body.style.overflow = 'hidden';
      this.destroyRef.onDestroy(() => {
        this.doc.body.style.overflow = '';
      });
    }
  }

  onDismiss(): void {
    this.dismiss.emit();
  }

  onFormSubmit(event: SubmitEvent): void {
    event.preventDefault();
    if (this.formMode()) {
      this.formSubmit.emit();
    }
  }
}
