import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChecklistTodosStore } from '@core/services/checklist-todos.store';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-checklist-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ToButtonComponent,
    ToIconButtonComponent,
    ToInputComponent,
  ],
  providers: [DateShortPipe],
  templateUrl: './checklist-drawer.component.html',
  styleUrls: [
    '../../../features/fleet/components/fleet-drawer.shared.scss',
    './checklist-drawer.component.scss',
  ],
})
export class ChecklistDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateShort = inject(DateShortPipe);
  readonly store = inject(ChecklistTodosStore);

  readonly dismiss = output<void>();

  readonly draft = model('');

  constructor() {
    this.doc.body.style.overflow = 'hidden';
    this.store.ensureLoaded();
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });
  }

  fmt(iso: string): string {
    return this.dateShort.transform(iso);
  }

  submitAdd(): void {
    if (this.store.add(this.draft())) {
      this.draft.set('');
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
