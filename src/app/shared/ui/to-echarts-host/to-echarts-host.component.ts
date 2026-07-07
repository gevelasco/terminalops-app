import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
} from '@angular/core';
import type { EChartsOption } from 'echarts';
import type { EChartsType } from 'echarts/core';
import { ensureAppEchartsModules } from '@shared/charts/app-echarts-modules';

@Component({
  selector: 'to-echarts-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="to-echarts-host"></div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
      min-height: 0;
      width: 100%;
      height: 100%;
    }

    .to-echarts-host {
      width: 100%;
      height: 100%;
      min-height: 0;
    }
  `,
})
export class ToEchartsHostComponent implements AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('host', { static: true })
  private readonly host!: ElementRef<HTMLDivElement>;

  readonly option = input<EChartsOption | null>(null);

  private chart: EChartsType | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const next = this.option();
      if (this.chart && next) {
        this.chart.setOption(next, { notMerge: true, lazyUpdate: true });
      }
    });
  }

  ngAfterViewInit(): void {
    const echarts = ensureAppEchartsModules();
    this.chart = echarts.init(this.host.nativeElement, undefined, { renderer: 'canvas' });
    const initial = this.option();
    if (initial && this.chart) {
      this.chart.setOption(initial);
    }

    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(this.host.nativeElement);
    this.destroyRef.onDestroy(() => this.dispose());
  }

  ngOnDestroy(): void {
    this.dispose();
  }

  private dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.chart?.dispose();
    this.chart = null;
  }
}
