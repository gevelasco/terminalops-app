import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { EquipmentHitchAssignmentValidation } from '@shared/utils/fleet/equipment-hitch-assignment';

@Component({
  selector: 'app-fleet-hitch-validation-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-hitch-validation-block.component.html',
})
export class FleetHitchValidationBlockComponent {
  readonly validation = input.required<EquipmentHitchAssignmentValidation>();
  readonly isSecondTrailer = input(false);
  readonly toggleLabelId = input.required<string>();

  readonly toggleSecondTrailer = output<void>();

  onToggleClick(): void {
    if (!this.validation().canToggleSecondTrailer) {
      return;
    }
    this.toggleSecondTrailer.emit();
  }
}
