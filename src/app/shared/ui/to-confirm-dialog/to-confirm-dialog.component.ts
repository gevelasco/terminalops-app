import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ToButtonComponent, type ToButtonVariant } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

@Component({
  selector: 'to-confirm-dialog',
  standalone: true,
  imports: [ToButtonComponent, ToIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './to-confirm-dialog.component.html',
  styleUrl: './to-confirm-dialog.component.scss',
})
export class ToConfirmDialogComponent {
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private closingFromParent = false;

  readonly open = input(false);
  readonly titleId = input.required<string>();
  readonly icon = input<ToIconName>('warning');
  readonly title = input.required<string>();
  readonly cancelLabel = input('Cancelar');
  readonly confirmLabel = input('Confirmar');
  readonly confirmDisabled = input(false);
  readonly confirmLoading = input(false);
  readonly confirmVariant = input<ToButtonVariant>('primary');

  readonly cancel = output<void>();
  readonly confirm = output<void>();

  constructor() {
    effect(() => {
      const el = this.dialogRef()?.nativeElement;
      if (!el) {
        return;
      }
      if (this.open()) {
        if (!el.open) {
          queueMicrotask(() => {
            if (this.open() && !el.open) {
              el.showModal();
            }
          });
        }
        return;
      }
      if (el.open) {
        this.closingFromParent = true;
        el.close();
        this.closingFromParent = false;
      }
    });
  }

  onDialogCancel(ev: Event): void {
    ev.preventDefault();
    this.cancel.emit();
  }

  onDialogClose(): void {
    if (!this.closingFromParent && this.open()) {
      this.cancel.emit();
    }
  }

  onCancelClick(): void {
    this.cancel.emit();
  }

  onConfirmClick(): void {
    this.confirm.emit();
  }
}
