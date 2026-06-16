import * as echarts from 'echarts/core';
import { LinesChart, ScatterChart } from 'echarts/charts';
import {
  GeoComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

let registered = false;

export function ensureTripsMapEchartsModules(): typeof echarts {
  if (!registered) {
    echarts.use([
      GeoComponent,
      LinesChart,
      ScatterChart,
      TooltipComponent,
      LegendComponent,
      CanvasRenderer,
    ]);
    registered = true;
  }
  return echarts;
}
