import * as echarts from 'echarts/core';
import {
  BarChart,
  CustomChart,
  GaugeChart,
  LineChart,
  PieChart,
  SunburstChart,
  TreemapChart,
} from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

let registered = false;

/** Registro único de módulos ECharts para dashboard, reportes y futuras tabs. */
export function ensureAppEchartsModules(): typeof echarts {
  if (!registered) {
    echarts.use([
      LineChart,
      BarChart,
      PieChart,
      GaugeChart,
      TreemapChart,
      CustomChart,
      SunburstChart,
      GridComponent,
      TooltipComponent,
      LegendComponent,
      TitleComponent,
      VisualMapComponent,
      CanvasRenderer,
    ]);
    registered = true;
  }
  return echarts;
}
