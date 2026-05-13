import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EQUIPMENT_AXLE_OPTIONS } from '@app/mock-data/equipment-axle-options';
import { ToastService } from '@core/notifications/toast.service';
import { EquipmentRepository } from '@features/fleet/data/equipment.repository';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-fleet-new-equipment-drawer',
  standalone: true,
  imports: [
    FormsModule,
    ToButtonComponent,
    ToIconButtonComponent,
    ToInputComponent,
    ToSelectComponent,
  ],
  templateUrl: './fleet-new-equipment-drawer.component.html',
  styleUrl: '../fleet-drawer.shared.scss',
})
export class FleetNewEquipmentDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly equipmentRepo = inject(EquipmentRepository);
  private readonly toast = inject(ToastService);

  readonly unitOptions = input.required<ToSelectOption[]>();

  readonly dismiss = output<void>();
  readonly saved = output<void>();

  readonly unitId = model('');
  readonly name = model('');
  readonly serialNumber = model('');
  /** Valor interno del select; vacío = no especificado. */
  readonly axleValue = model('');
  readonly lastServiceDate = model('');
  readonly saving = model(false);

  readonly axleOptions = EQUIPMENT_AXLE_OPTIONS;

  constructor() {
    this.doc.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  submit(): void {
    const uid = this.unitId().trim();
    const name = this.name().trim();
    const serial = this.serialNumber().trim();
    const svc = this.lastServiceDate().trim();
    if (!uid || !name || !serial || !svc) {
      this.toast.show('Completa unidad, nombre, serie y fecha de servicio.', 'warning');
      return;
    }
    const axleKey = this.axleValue().trim();
    const axleConfiguration = axleKey
      ? (this.axleOptions.find((o) => o.value === axleKey)?.label ?? axleKey)
      : undefined;

    this.saving.set(true);
    this.equipmentRepo
      .create({
        unitId: uid,
        name,
        serialNumber: serial,
        lastServiceDate: svc,
        axleConfiguration,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.show('Equipo registrado.', 'success');
          this.saved.emit();
          this.dismiss.emit();
        },
        error: () => {
          this.toast.show('No se pudo guardar el equipo.', 'error');
          this.saving.set(false);
        },
      });
  }
}
