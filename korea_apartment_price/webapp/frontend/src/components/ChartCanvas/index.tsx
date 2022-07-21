import * as React from 'react';
import * as THREE from 'three'

import { Canvas } from '@react-three/fiber'
import { ChartViewContext, useChartViewInfo } from "./utils/ChartViewContext";
import { PlayForWork } from '@mui/icons-material';

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
  const relY = 1.0 - ((y / h) - prop.chartRegion[1]) / (prop.chartRegion[3] - prop.chartRegion[1]);
  if (relX < 0.0 || relX > 1.0 || relY < 0.0 || relY > 1.0) return null;
  const dataX = visibleRange[0] + relX * (visibleRange[2] - visibleRange[0]);
  const dataY = visibleRange[1] + relY * (visibleRange[3] - visibleRange[1]);
  return [dataX, dataY];
}

const clientCoordToChartCoord = (prop: ChartCanvasProp, eventCoord: [number, number], canvasSize: [number, number]): [number, number] | null => {
  const [w, h] = canvasSize;
  const [x, y] = eventCoord;
  const relX = ((x / w) - prop.chartRegion[0]) / (prop.chartRegion[2] - prop.chartRegion[0]);
  const relY = 1.0 - ((y / h) - prop.chartRegion[1]) / (prop.chartRegion[3] - prop.chartRegion[1]);
  if (relX < 0.0 || relX > 1.0 || relY < 0.0 || relY > 1.0) return null;
  return [relX, relY];
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
      dx1 *= 0.9; dy1 *= 0.9; dx2 *= 0.9; dy2 *= 0.9;

      if (prop.maxZoom) {
        const ratioX = prop.maxZoom[0] / (dx2 - dx1);
        const ratioY = prop.maxZoom[1] / (dy2 - dy1);
        if (ratioX > 1.0) { dx1 *= ratioX; dx2 *= ratioX; }
        if (ratioY > 1.0) { dy1 *= ratioY; dy2 *= ratioY; }
      }
    } else {
      dx1 *= 1.1; dy1 *= 1.1; dx2 *= 1.1; dy2 *= 1.1;
    }

    const newVisibleRange: [number, number, number, number] = [
      clip(prop.dataRange[0], prop.dataRange[2], dx1 + eventCoord[0]),
      clip(prop.dataRange[1], prop.dataRange[3], dy1 + eventCoord[1]),
      clip(prop.dataRange[0], prop.dataRange[2], dx2 + eventCoord[0]),
      clip(prop.dataRange[1], prop.dataRange[3], dy2 + eventCoord[1]),
    ];
    setVisibleRange(newVisibleRange);
  };

  const [pointerAnchors, setPointerAnchors] = React.useState<Record<string, {x: number, y:number}>>({});
  const [currentPointers, setCurrentPointers] = React.useState<Record<string, {x: number, y:number}>>({});
  const [visibleRangeSnapshot, setVisibleRangeSnapshot] = React.useState<[number,number,number,number]>(visibleRange);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (canvasRef.current) {
      const relCoord = clientCoordToChartCoord(prop, [e.clientX, e.clientY], [canvasRef.current.width, canvasRef.current.height]);
      if (!relCoord) return;
      const [x, y] = relCoord;

      const newCurrentPointers = Object.assign({}, currentPointers);
      newCurrentPointers[e.pointerId] = { x, y };

      setPointerAnchors(newCurrentPointers);
      setCurrentPointers(newCurrentPointers);
      setVisibleRangeSnapshot(visibleRange);
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (canvasRef.current && pointerAnchors[e.pointerId]) {
      const relCoord = clientCoordToChartCoord(prop, [e.clientX, e.clientY], [canvasRef.current.width, canvasRef.current.height]);
      if (!relCoord) return;
      const [x, y] = relCoord;

      setCurrentPointers(ptr=>{
        return {...ptr, [e.pointerId]: {x, y}};
      });
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerAnchors[e.pointerId]) {
      const newPointerAnchors = Object.assign({}, pointerAnchors);
      delete newPointerAnchors[e.pointerId];
      setPointerAnchors(newPointerAnchors);
    }

    if (currentPointers[e.pointerId]) {
      const newCurrentPointers = Object.assign({}, currentPointers);
      delete newCurrentPointers[e.pointerId];
      setCurrentPointers(newCurrentPointers);
    }

    setVisibleRangeSnapshot(visibleRange);
  }

  React.useEffect(()=>{
    if (Object.keys(currentPointers).length !== Object.keys(pointerAnchors).length)
      return;

    if (canvasRef.current) {
      const numPointers = Object.keys(currentPointers).length;
      if (numPointers === 1) {
        const pointerId = Object.keys(pointerAnchors)[0];
        const p1 = pointerAnchors[pointerId];
        const p2 = currentPointers[pointerId];
        const newW = visibleRangeSnapshot[2] - visibleRangeSnapshot[0];
        const newH = visibleRangeSnapshot[3] - visibleRangeSnapshot[1];
        const newX0 = clip(prop.dataRange[0], prop.dataRange[2] - newW, (p1.x - p2.x) * newW + visibleRangeSnapshot[0]);
        const newY0 = clip(prop.dataRange[1], prop.dataRange[3] - newH, (p1.y - p2.y) * newH + visibleRangeSnapshot[1]);

        const newVisibleRange: [number,number,number,number] = [newX0, newY0, newX0 + newW, newY0 + newH];
        setVisibleRange(newVisibleRange);
      } else if (numPointers === 2){
        const [pointerId1, pointerId2] = Object.keys(pointerAnchors);
        const p11 = pointerAnchors[pointerId1];
        const p12 = currentPointers[pointerId1];
        const p21 = pointerAnchors[pointerId2];
        const p22 = currentPointers[pointerId2];

        const newW = clip(prop.maxZoom?.at(0) || 0, prop.dataRange[2] - prop.dataRange[0], Math.abs((visibleRangeSnapshot[2] - visibleRangeSnapshot[0]) * (p21.x - p11.x) / (p22.x - p12.x)));
        const newH = clip(prop.maxZoom?.at(1) || 0, prop.dataRange[3] - prop.dataRange[1], Math.abs((visibleRangeSnapshot[3] - visibleRangeSnapshot[1]) * (p21.y - p11.y) / (p22.y - p12.y)));

        const newX0 = clip(prop.dataRange[0], prop.dataRange[2] - newW, ((p11.x + p21.x) * 0.5 * (visibleRangeSnapshot[2] - visibleRangeSnapshot[0])) - (p12.x + p22.x) * 0.5 * newW + visibleRangeSnapshot[0]);
        const newY0 = clip(prop.dataRange[1], prop.dataRange[3] - newH, ((p11.y + p21.y) * 0.5 * (visibleRangeSnapshot[3] - visibleRangeSnapshot[1])) - (p12.y + p22.y) * 0.5 * newH + visibleRangeSnapshot[1]);

        const newVisibleRange: [number,number,number,number] = [newX0, newY0, newX0 + newW, newY0 + newH];
        setVisibleRange(newVisibleRange);
      }
    }
  }, [canvasRef, pointerAnchors, currentPointers]);

  const handleDoubleClick=()=>{
    setVisibleRange(
      (prop.defaultVisibleRange) ? prop.defaultVisibleRange : prop.dataRange
    );
  }

  return (
    <Canvas
      ref={canvasRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      dpr={1}
      style={{ touchAction: 'none'}}
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
