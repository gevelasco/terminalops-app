import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@core/notifications/toast.service';
import { ChecklistTodosStore } from '@core/services/state/checklist-todos';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
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
    ToIconComponent,
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
  private readonly toast = inject(ToastService);
  readonly store = inject(ChecklistTodosStore);

  readonly dismiss = output<void>();

  readonly draft = model('');

  readonly completedCount = computed(
    () => this.store.todos().length - this.store.pendingCount(),
  );

  constructor() {
    void this.store.refresh().catch((err) => {
      this.toast.show(
        parseHttpApiErrorMessage(err) ?? 'No se pudo cargar el checklist.',
        'error',
      );
    });
  }

  fmt(iso: string): string {
    return this.dateShort.transform(iso);
  }

  async submitAdd(): Promise<void> {
    if (this.store.mutating()) {
      return;
    }
    try {
      const ok = await this.store.add(this.draft());
      if (ok) {
        this.draft.set('');
      }
    } catch (err) {
      this.toast.show(
        parseHttpApiErrorMessage(err) ?? 'No se pudo guardar la tarea.',
        'error',
      );
    }
  }

  async onToggle(id: string): Promise<void> {
    try {
      await this.store.toggleCompleted(id);
    } catch (err) {
      this.toast.show(
        parseHttpApiErrorMessage(err) ?? 'No se pudo actualizar la tarea.',
        'error',
      );
    }
  }

  async onRemove(id: string): Promise<void> {
    try {
      await this.store.remove(id);
    } catch (err) {
      this.toast.show(
        parseHttpApiErrorMessage(err) ?? 'No se pudo eliminar la tarea.',
        'error',
      );
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
