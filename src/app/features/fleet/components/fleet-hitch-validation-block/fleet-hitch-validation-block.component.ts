import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EquipmentHitchAssignmentValidation } from '@shared/utils/fleet/equipment-hitch-assignment';

@Component({
  selector: 'app-fleet-hitch-validation-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-hitch-validation-block.component.html',
  styleUrl: './fleet-hitch-validation-block.component.scss',
})
export class FleetHitchValidationBlockComponent {
  readonly validation = input.required<EquipmentHitchAssignmentValidation>();
  /** Oculta avisos informativos (p. ej. al asignar tractora en drawer de equipo). */
  readonly hideInfo = input(false);
}
