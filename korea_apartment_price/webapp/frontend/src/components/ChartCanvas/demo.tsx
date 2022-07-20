import * as React from 'react';
import * as THREE from 'three'

import { ChartPointMarkerGroup } from './objects/PointMarkerGroup';
import { ChartStyledPathGroup } from './objects/StyledPathGroup';
import { ChartLineGroup, Line } from './objects/LineGroup';
import { ChartFilledAreaGroup } from './objects/FilledAreaGroup';
import ChartCanvas from '.';

export default function ChartDemo() {
  const numPts = 100;
  const numTheta = 100;
  const numLines = 5;

  const [ptsX, ptsY, ptsSize] = React.useMemo<[Float32Array, Float32Array, number]>(()=>{
    const x = new Float32Array(numPts);
    const y = new Float32Array(numPts);
    for (let i=0; i<numPts; i++) {
      x[i] = (Math.random() - 0.5) * 2.0;
      y[i] = (Math.random() * 0.5) + Math.sin(x[i]);
    }
    return [x, y, 12];
  }, []);

  const [lineX01, lineY01, color01] = React.useMemo<[Float32Array, Float32Array, Uint8Array]>(()=>{
    const x = new Float32Array(numTheta);
    const y = new Float32Array(numTheta);
    const c = new Uint8Array(numTheta * 4);
    for (let i=0; i<numTheta; i++) {
      const theta = i * 2 * 3.141592 / (numTheta - 1 );
      const r = Math.cos(5 * theta - 3.141592 / 2) * 0.2 + 0.7
      x[i] = r * Math.cos(theta)
      y[i] = r * Math.sin(theta)
      const curColor = new THREE.Color()
      curColor.setHSL(i /numTheta, 0.9, 0.4);
      c[i * 4] = Math.floor(curColor.r * 255.0);
      c[i * 4+1] = Math.floor(curColor.g * 255.0);
      c[i * 4+2] = Math.floor(curColor.b * 255.0);
      c[i * 4+3] = Math.floor((0.5 + Math.cos(theta * 3) * 0.2) * 255.0);
    }
    return [x, y, c];
  }, []);

  const [lineX02, lineY02] = React.useMemo<[Float32Array, Float32Array]>(()=>{
    const x = new Float32Array(numTheta);
    const y = new Float32Array(numTheta);
    for (let i=0; i<numTheta; i++) {
      const theta = i * 2 * 3.141592 / (numTheta - 1 );
      const r = Math.cos(5 * theta - 3.141592 / 2) * 0.05 + 0.3
      x[i] = r * Math.cos(theta) + 0.3
      y[i] = r * Math.sin(theta) + 0.4
    }
    return [x, y];
  }, []);

  const [lines] = React.useMemo<[Line[]]>(()=>{
    const lines: Line[] = [];

    for (let i=0; i<numLines; i++) {
      const theta = (i + 0.125) * 2 * 3.141592 / (numLines );
      const r = 0.1;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      const dx = - Math.sin(theta); 
      const dy = Math.cos(theta);
      lines.push({
        x, y, dx, dy, width: i +1
      })
    }
    lines.push({x: 0.5, y:0.5, dx:0.0, dy:-1, color:0x0000ffff, width: 5})
    lines.push({x: 0.5, y:0.5, dx:-1, dy:-0.0, color:0xff00ffff, width: 6})
    return [lines];
  }, []);
  
  
  const camera = React.useMemo<THREE.OrthographicCamera>(()=>{
    return new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  }, []);

  return (
      <ChartCanvas
        dataRange={[-2, -2, 2, 2]}
        chartRegion={[0.1, 0.1, 0.9, 0.9]}
      >
        <ChartLineGroup lines={lines}
          width={4} color={0xFF0000FF} 
          zOrder={2}
        />
        <ChartPointMarkerGroup x={ptsX} y={ptsY} size={ptsSize}
          fillColor={0xFFFF00FF} 
          borderColor={0x000000FF}
          borderWidth={2}
          markerType="triangle" />
        <ChartStyledPathGroup paths={[
          { x: lineX01, y: lineY01, color: color01, width: 20 },
          { x: lineX02, y: lineY02 },
        ]} 
          width={2} color={0xFF0000FF} 
          zOrder={1}
        />
        <ChartFilledAreaGroup filledArea={[
          {
            contour: { x: lineX01, y: lineY01},
            color: 0xFF000088
          }
        ]} 
          color={0xFFFF00FF} 
        />
      </ChartCanvas>
  )
}
