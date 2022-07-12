import * as React from 'react';
import * as THREE from 'three'

import { Canvas } from '@react-three/fiber'
import { ChartPointMarkerGroup } from './objects/PointMarkerGroup';
import { ChartStyledPathGroup } from './objects/StyledPathGroup';


export default function ChartDemo() {
  const numPts = 1000;
  const numTheta = 20000;

  const [ptsX, ptsY, ptsSize] = React.useMemo<[Float32Array, Float32Array, number]>(()=>{
    const x = new Float32Array(numPts);
    const y = new Float32Array(numPts);
    for (let i=0; i<numPts; i++) {
      x[i] = (Math.random() - 0.5) * 2.0;
      y[i] = (Math.random() * 0.5) + Math.sin(x[i]);
    }
    return [x, y, 12];
  }, []);

  const [lineX01, lineY01] = React.useMemo<[Float32Array, Float32Array]>(()=>{
    const x = new Float32Array(numTheta);
    const y = new Float32Array(numTheta);
    for (let i=0; i<numTheta; i++) {
      const theta = i * 2 * 3.141592 / (numTheta - 1 );
      const r = Math.cos(5 * theta - 3.141592 / 2) * 0.2 + 0.7
      x[i] = r * Math.cos(theta)
      y[i] = r * Math.sin(theta)
    }
    return [x, y];
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
  
  const camera = React.useMemo<THREE.OrthographicCamera>(()=>{
    return new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  }, []);

  return (
    <Canvas>
      <ChartPointMarkerGroup x={ptsX} y={ptsY} size={ptsSize}
        fillColor={0xFFFF00FF} 
        borderColor={0x000000FF}
        borderWidth={2}
        visibleRange={[-1.0, -1.0, 1.0, 1.0]}
        chartRegion={[0.2, 0.2, 0.8, 0.8]}
        markerType="triangle" />
      <ChartStyledPathGroup paths={[
        { x: lineX01, y: lineY01 },
        { x: lineX02, y: lineY02 },
      ]} lineWidth={2} lineColor={0xFF0000FF} 
        visibleRange={[-1.0, -1.0, 1.0, 1.0]}
        chartRegion={[0.2, 0.2, 0.8, 0.8]}
        zOrder={1}
      />
    </Canvas>
  )
}

/*

      <color attach="background" args={["blue"]} />

*/