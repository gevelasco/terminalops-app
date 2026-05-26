import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

export type ToSegmentControlLayout = 'default' | 'drawer' | 'toolbar' | 'fill';

export interface ToSegmentTab<T extends string = string> {
  id: T;
  label: string;
  icon?: ToIconName;
  iconPath?: string;
  iconViewBox?: string;
  htmlId?: string;
}

@Component({
  selector: 'to-segment-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, ToIconComponent],
  templateUrl: './to-segment-control.component.html',
  styleUrl: './to-segment-control.component.scss',
  host: {
    class: 'to-segment-control-host',
    '[class.to-segment-control-host--drawer]': 'layout() === "drawer"',
    '[class.to-segment-control-host--toolbar]': 'layout() === "toolbar"',
    '[class.to-segment-control-host--fill]': 'layout() === "fill"',
  },
})
export class ToSegmentControlComponent<T extends string = string> {
  readonly tabs = input.required<readonly ToSegmentTab<T>[]>();
  readonly activeId = input.required<T>();
  readonly ariaLabel = input('Secciones');
  /** `default`: ancho contenido; `drawer`: ancho completo en sidemenus; `toolbar`: barra de herramientas; `fill`: crece en fila flex. */
  readonly layout = input<ToSegmentControlLayout>('default');
  readonly hostClass = input('');

  readonly tabSelect = output<T>();

  onSelect(id: T): void {
    this.tabSelect.emit(id);
  }
}
