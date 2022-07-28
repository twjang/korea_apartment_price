import React from 'react';

export type ChartViewContextProp = {
  visibleRange: [number, number, number, number];
  chartRegion: [number, number, number, number];
};

export const ChartViewContext = React.createContext({} as ChartViewContextProp);

export const useChartViewInfo = (): ChartViewContextProp => {
  return React.useContext(ChartViewContext);
};
