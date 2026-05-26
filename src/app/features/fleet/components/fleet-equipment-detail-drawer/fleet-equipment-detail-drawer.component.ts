import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { Equipment, Unit } from '@shared/models/logistics.models';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToStatusPillComponent } from '@shared/ui/to-status-pill/to-status-pill.component';
import { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import { FleetEquipmentDetailCobTabComponent } from './tabs/fleet-equipment-detail-cob-tab.component';
import { FleetEquipmentDetailFichaTabComponent } from './tabs/fleet-equipment-detail-ficha-tab.component';
import { FleetEquipmentDetailMantTabComponent } from './tabs/fleet-equipment-detail-mant-tab.component';
import { FleetEquipmentDetailDrawerStore } from './fleet-equipment-detail-drawer.store';

@Component({
  selector: 'app-fleet-equipment-detail-drawer',
  standalone: true,
  providers: [FleetEquipmentDetailDrawerStore],
  imports: [
    ToSideDrawerComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ToStatusPillComponent,
    FleetEquipmentDetailFichaTabComponent,
    FleetEquipmentDetailMantTabComponent,
    FleetEquipmentDetailCobTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-equipment-detail-drawer.component.html',
  styleUrls: [
    '../fleet-drawer.shared.scss',
    '../styles/fleet-drawer-unit-sec.shared.scss',
    '../fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
  ],
})
export class FleetEquipmentDetailDrawerComponent {
  protected readonly vm = inject(FleetEquipmentDetailDrawerStore);

  readonly equipment = input.required<Equipment>();
  /** Opciones de unidad tractora (mismo catálogo que alta de equipo). */
  readonly unitOptions = input<ToSelectOption[]>([]);
  /** Catálogo de tractoras para resolver enganche en ficha técnica. */
  readonly unitCatalog = input<Unit[]>([]);
  /** Maniobra en curso del enganche (`unitId`), misma regla que la tabla Flota. */
  readonly onRoute = input(false);
  /** Maniobras completadas de la unidad tractora (para contexto de km). */
  readonly completedManeuverCount = input(0);

  readonly dismiss = output<void>();

  constructor() {
    effect(() => {
      this.vm.bindHost(
        {
          equipment: this.equipment(),
          unitOptions: this.unitOptions(),
          unitCatalog: this.unitCatalog(),
          onRoute: this.onRoute(),
          completedManeuverCount: this.completedManeuverCount(),
        },
        {
          dismiss: () => this.dismiss.emit(),
        },
      );
    });

    afterNextRender(() => this.vm.markReady());
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    this.vm.onDocKey(ev);
  }
}
