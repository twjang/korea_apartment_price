import * as React from 'react';
import * as THREE from 'three'

import { Canvas } from '@react-three/fiber'
import { ChartViewContext, useChartViewInfo } from "./utils/ChartViewContext";

export type ChartCanvasProp = {
  chartRegion: [number, number, number, number],
  maxZoom?: [number, number]
  dataRange: [number, number, number, number];
  defaultVisibleRange?: [number, number, number, number],
  children?:JSX.Element[]
};

const clip = (a: number, b:number, x:number): number =>{
  [a, b] = [Math.min(a, b), Math.max(a, b)];
  return Math.max(a, Math.min(b, x));
}

const clientCoordToDataCoord = (prop: ChartCanvasProp, eventCoord: [number, number], canvasSize: [number, number], visibleRange: [number, number, number, number]): [number, number] | null => {
  const [w, h] = canvasSize;
  const [x, y] = eventCoord;
  const relX = ((x / w) - prop.chartRegion[0]) / (prop.chartRegion[2] - prop.chartRegion[0]);
  const relY = ((y / h) - prop.chartRegion[1]) / (prop.chartRegion[3] - prop.chartRegion[1]);
  if (relX < 0.0 || relX > 1.0 || relY < 0.0 || relY > 1.0) return null;
  const dataX = visibleRange[0] + relX * (visibleRange[2] - visibleRange[0]);
  const dataY = visibleRange[1] + (1.0 - relY) * (visibleRange[3] - visibleRange[1]);
  return [dataX, dataY];
}

const ChartCanvas = (prop:ChartCanvasProp) =>{ 
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [visibleRange, setVisibleRange] = React.useState<[number, number, number, number]>(
    (prop.defaultVisibleRange)? prop.defaultVisibleRange: prop.dataRange
  );

  const handleWheel = (e: React.WheelEvent)=>{
    const eventCoord = (canvasRef.current)? 
      clientCoordToDataCoord(prop, 
        [e.clientX, e.clientY], [canvasRef.current.width, canvasRef.current.height], visibleRange): null;
    
    if (!eventCoord) return;
    
    let dx1 = visibleRange[0] - eventCoord[0];
    let dy1 = visibleRange[1] - eventCoord[1];
    let dx2 = visibleRange[2] - eventCoord[0];
    let dy2 = visibleRange[3] - eventCoord[1];

    if (e.deltaY > 0) {
      dx1 *= 0.9;
      dy1 *= 0.9;
      dx2 *= 0.9;
      dy2 *= 0.9;

      if (prop.maxZoom) {
        const ratioX = prop.maxZoom[0] / (dx2 - dx1);
        const ratioY = prop.maxZoom[1] / (dy2 - dy1);
        if (ratioX > 1.0) {
          dx1 *= ratioX;
          dx2 *= ratioX;
        }
        if (ratioY > 1.0) {
          dy1 *= ratioY;
          dy2 *= ratioY;
        }
      }
    } else {
      dx1 *= 1.1;
      dy1 *= 1.1;
      dx2 *= 1.1;
      dy2 *= 1.1;
    }

    const newVisibleRange: [number, number, number, number] = [
      clip(prop.dataRange[0], prop.dataRange[2], dx1 + eventCoord[0]),
      clip(prop.dataRange[1], prop.dataRange[3], dy1 + eventCoord[1]),
      clip(prop.dataRange[0], prop.dataRange[2], dx2 + eventCoord[0]),
      clip(prop.dataRange[1], prop.dataRange[3], dy2 + eventCoord[1]),
    ];
    setVisibleRange(newVisibleRange);
  };

  return (
    <Canvas
      ref={canvasRef}
      onWheel={handleWheel}
      dpr={1}
    >
      <ChartViewContext.Provider value={{
        visibleRange,
        chartRegion: prop.chartRegion,
      }}>
        {prop.children}
      </ChartViewContext.Provider>
    </Canvas>
  )
}

export default ChartCanvas;
