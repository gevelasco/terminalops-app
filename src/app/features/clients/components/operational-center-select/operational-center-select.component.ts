import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
} from '@angular/core';
import {
  isOperationalCenterNewRoute,
  OPERATIONAL_CENTER_NEW_ROUTE_VALUE,
} from '@features/clients/constants/operational-center-new-route';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import type { OperationalCenter } from '@shared/models/operational-center.models';
import { ToSelectComponent, type ToSelectOption } from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-operational-center-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToSelectComponent],
  template: `
    <to-select
      label="Centro operativo"
      [options]="options()"
      [disabled]="disabled() || loading()"
      [(value)]="selectedCenterId"
    />
  `,
})
export class OperationalCenterSelectComponent {
  private readonly centersFeature = inject(OperationalCentersFeatureService);

  readonly disabled = input(false);
  /** Muestra «Nueva ruta» para capturar origen manualmente (p. ej. maniobras). */
  readonly includeNewRouteOption = input(false);
  readonly selectedCenterId = model('');

  readonly loading = this.centersFeature.loading;

  readonly options = computed((): ToSelectOption[] => {
    const centerOpts = this.centersFeature.centers().map((c) => ({
      value: c.id,
      label: c.name?.trim() || 'Centro Principal',
    }));
    if (!this.includeNewRouteOption()) {
      return centerOpts;
    }
    return [
      ...centerOpts,
      { value: OPERATIONAL_CENTER_NEW_ROUTE_VALUE, label: 'Nueva ruta' },
    ];
  });

  constructor() {
    this.centersFeature.loadOperationalCenters();
    effect(() => {
      const list = this.centersFeature.centers();
      const current = this.selectedCenterId().trim();
      if (
        current &&
        (list.some((c) => c.id === current) ||
          (this.includeNewRouteOption() && isOperationalCenterNewRoute(current)))
      ) {
        return;
      }
      const fallback = list.find((c) => c.isDefault) ?? list[0];
      if (fallback) {
        this.selectedCenterId.set(fallback.id);
      }
    });
  }

  selectedCenter(): OperationalCenter | null {
    return this.centersFeature.centerById(this.selectedCenterId());
  }
}
