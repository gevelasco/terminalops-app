import { Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@core/notifications/toast.service';
import {
  operatorHasPhoto,
  operatorPhotoInitials,
  readOperatorPhotoDataUrl,
} from '@features/operators/utils/operator-photo';
import type { OperatorLicenseType } from '@shared/models/logistics.models';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-operator-identification-fields',
  standalone: true,
  imports: [FormsModule, ToInputComponent, ToSelectComponent],
  templateUrl: './operator-identification-fields.component.html',
  styleUrl: './operator-identification-fields.component.scss',
})
export class OperatorIdentificationFieldsComponent {
  private readonly toast = inject(ToastService);

  readonly layout = input<'new' | 'edit'>('new');
  readonly licenseTypeOptions = input.required<ToSelectOption[]>();
  readonly photoDisabled = input(false);

  readonly fullName = model('');
  readonly birthDate = model('');
  readonly curp = model('');
  readonly rfc = model('');
  readonly licenseNumber = model('');
  readonly licenseExpiresOn = model('');
  readonly licenseType = model<OperatorLicenseType>('unspecified');
  readonly licenseEndorsements = model('');
  readonly phone = model('');
  readonly phoneSecondary = model('');
  readonly address = model('');
  readonly photoDataUrl = model('');

  readonly photoSaving = signal(false);

  readonly hasPhoto = computed(() => operatorHasPhoto(this.photoDataUrl()));
  readonly photoInitials = computed(() =>
    operatorPhotoInitials(this.fullName().trim() || 'Operador'),
  );

  onPhotoSelected(ev: Event): void {
    if (this.photoDisabled()) {
      return;
    }
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.photoSaving.set(true);
    readOperatorPhotoDataUrl(file)
      .then((url) => {
        this.photoDataUrl.set(url);
        this.photoSaving.set(false);
      })
      .catch((err: Error) => {
        this.photoSaving.set(false);
        if (err.message === 'not-image') {
          this.toast.show('Selecciona un archivo de imagen.', 'warning');
        } else if (err.message === 'too-large') {
          this.toast.show('La imagen debe pesar menos de 2 MB.', 'warning');
        } else {
          this.toast.show('No se pudo leer la imagen.', 'warning');
        }
      });
  }

  removePhoto(): void {
    if (this.photoDisabled()) {
      return;
    }
    this.photoDataUrl.set('');
  }
}
