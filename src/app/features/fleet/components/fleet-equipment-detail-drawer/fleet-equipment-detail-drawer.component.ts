import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { labelForUnitId } from '@app/mock-data/mock-units';
import { Equipment } from '@shared/models/logistics.models';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';

@Component({
  selector: 'app-fleet-equipment-detail-drawer',
  standalone: true,
  imports: [ToIconButtonComponent],
  templateUrl: './fleet-equipment-detail-drawer.component.html',
  styleUrls: ['../fleet-drawer.shared.scss', './fleet-equipment-detail-drawer.component.scss'],
})
export class FleetEquipmentDetailDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly equipment = input.required<Equipment>();

  readonly dismiss = output<void>();

  readonly unitLabel = computed(() => labelForUnitId(this.equipment().unitId));

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
}
