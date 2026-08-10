import { lazy, Suspense } from 'react';

function createLazyRechart(name) {
  const LazyComponent = lazy(() =>
    import('recharts').then((mod) => ({ default: mod[name] }))
  );

  function LazyRechart(props) {
    return (
      <Suspense fallback={null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  }

  LazyRechart.displayName = name;
  return LazyRechart;
}

export const ResponsiveContainer = createLazyRechart('ResponsiveContainer');
export const LineChart = createLazyRechart('LineChart');
export const Line = createLazyRechart('Line');
export const AreaChart = createLazyRechart('AreaChart');
export const Area = createLazyRechart('Area');
export const XAxis = createLazyRechart('XAxis');
export const YAxis = createLazyRechart('YAxis');
export const CartesianGrid = createLazyRechart('CartesianGrid');
export const Tooltip = createLazyRechart('Tooltip');
export const PieChart = createLazyRechart('PieChart');
export const Pie = createLazyRechart('Pie');
export const Cell = createLazyRechart('Cell');
export const BarChart = createLazyRechart('BarChart');
export const Bar = createLazyRechart('Bar');
export const RadarChart = createLazyRechart('RadarChart');
export const Radar = createLazyRechart('Radar');
export const PolarGrid = createLazyRechart('PolarGrid');
export const PolarAngleAxis = createLazyRechart('PolarAngleAxis');
export const PolarRadiusAxis = createLazyRechart('PolarRadiusAxis');
export const ReferenceLine = createLazyRechart('ReferenceLine');
export const Legend = createLazyRechart('Legend');
export const ComposedChart = createLazyRechart('ComposedChart');
