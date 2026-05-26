import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChecklistTodosStore } from '@core/services/state/checklist-todos';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-checklist-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToSideDrawerComponent,
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
  private readonly dateShort = inject(DateShortPipe);
  readonly store = inject(ChecklistTodosStore);

  readonly dismiss = output<void>();

  readonly draft = model('');

  constructor() {
    this.store.ensureLoaded();
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
