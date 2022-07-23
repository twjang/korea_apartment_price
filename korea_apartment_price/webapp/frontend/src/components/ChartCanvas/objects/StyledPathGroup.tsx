import * as React from 'react';
import * as THREE from 'three';
import { ChartObjectProp } from '../types';
import { useThree } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
import { makeArrayFromNumber } from '../utils';
import { fromDashType } from '../textureBuilder/fromDashType';
import { useChartViewInfo } from '../utils/ChartViewContext';


export type Path = {
  x: Float32Array
  y: Float32Array
  color?: Uint8Array | number // Override the default color. repeated [r, g, b, a] values.
  width?: number // Override the default width. max 255.
}

const getDist=(p:Path, idx1: number, idx2:number): number=> {
  if (idx1 < 0) idx1 += p.x.length;
  if (idx2 < 0) idx2 += p.x.length;
  const dx = p.x[idx1] - p.x[idx2];
  const dy = p.y[idx1] - p.y[idx2];
  return Math.sqrt(dx * dx + dy * dy);
}


export type ChartStyledPathGroupProp = {
  paths: Path[]
  width: number // size in pixel
  color: number;
  dashType?: number[];
} & ChartObjectProp;


/// Parameters

const maxTextureWidth = 4096;
const numAngleHist = 5; // the size of cumulative length histogram
// if distance of two ends of the path is smaller than distEps,
// we consider this path is closed. This is used to determine the shape of 
// the joint of the two ends.
const distEps = 1e-4; 



export const ChartStyledPathGroup = (prop:ChartStyledPathGroupProp)=>{
  const threeCtx = useThree();
  const chartViewInfo = useChartViewInfo();
  const [dashPatternTexture, setDashPatternTexture] = React.useState<THREE.DataTexture | null>(null);
  const [patternSize, setPatternSize] = React.useState<number | null>(null);
  const shaderRef = React.useRef<ShaderMaterial>(null);

  React.useEffect(()=>{
    (async () => {
      const textures = await fromDashType({dash: {pattern: prop.dashType || [10]}});
      setDashPatternTexture(textures.texture);
      setPatternSize(textures.patternSize['dash']);
    })();
  }, [prop.dashType]);

  const sharedLineColor = React.useMemo<THREE.Vector4>(()=>{
    const t = makeArrayFromNumber(prop.color, 1.0 / 255.0);
    const fillColor = new THREE.Vector4(t[0], t[1], t[2], t[3]);
    return fillColor;
  }, [prop.color]);


  const [numPoints, numTriangles] = React.useMemo<[number, number]>(()=>{
    let cntPoints = 0;
    let cntTriangles = 0;
    prop.paths.forEach(path=>{ 
      if (path.x.length < 2 || path.x.length !== path.y.length)
        return;
      cntPoints += path.x.length;
      cntTriangles += (path.x.length - 1) * 2;
    });
    return [cntPoints, cntTriangles];
  }, [prop.paths]);

     
  const [vertPositions, vertColor, vertWidth, vertTgntA, vertTgntB, vertDirection, cumLenHist, maxCumLenHist, vertIndices, vertPointId] = React.useMemo<[
    Float32Array, Uint8Array, Uint16Array, Float32Array, Float32Array, Uint8Array, Float32Array, number, Uint32Array, Float32Array
  ]>(() => {
    const vertPositions = new Float32Array(numPoints * 6);
    const vertColor = new Uint8Array(numPoints * 8);
    const vertWidth = new Uint16Array(numPoints * 2);
    const vertTgntA = new Float32Array(numPoints * 4);
    const vertTgntB = new Float32Array(numPoints * 4);
    const vertDirection = new Uint8Array(numPoints * 2);
    const vertIndices = new Uint32Array(numTriangles * 3);
    const vertPointId = new Float32Array(numPoints * 2);
    const cumLenHist: Float32Array = (()=> {
      const numHistsPerRow = Math.floor(maxTextureWidth / numAngleHist);
      const numHistsRows = Math.ceil(numPoints / numHistsPerRow);
      return new Float32Array(numAngleHist * numHistsRows * numHistsPerRow);
    })();


    for (let i=0; i<numPoints; i++) {
      vertPointId[2 * i] = i;
      vertPointId[2 * i + 1] = i;
    }

    let ptsIdx = 0;
    let triangleIdx = 0;
    prop.paths.forEach((path)=>{
      if (path.x.length < 2) {
        console.warn('degenerate path (length < 2) detected');
        return;
      }
      if (path.x.length !== path.y.length) {
        console.warn('errornous path (x.length !== y.length) detected');
        return;
      }
      const closedPath = getDist(path, 0, -1) < distEps;

      let ptsIdx2 = ptsIdx * 2;
      let ptsIdx4 = ptsIdx * 4;
      let ptsIdx6 = ptsIdx * 6;
      let ptsIdx8 = ptsIdx * 8;

      let idx2=0;
      let idx4=0;
      let idx6=0;
      let idx8=0;

      if (typeof path.color === 'number' || path.color === undefined) {
        const [r, g, b, a] = makeArrayFromNumber(path.color || prop.color);
        idx8 = 0;
        for (let i=0; i<path.x.length; i++) {
          vertColor[ptsIdx8 + idx8 + 0] = r;
          vertColor[ptsIdx8 + idx8 + 1] = g;
          vertColor[ptsIdx8 + idx8 + 2] = b;
          vertColor[ptsIdx8 + idx8 + 3] = a;
          vertColor[ptsIdx8 + idx8 + 4] = r;
          vertColor[ptsIdx8 + idx8 + 5] = g;
          vertColor[ptsIdx8 + idx8 + 6] = b;
          vertColor[ptsIdx8 + idx8 + 7] = a;
          idx8 += 8;
        }
      } else {
        if (path.x.length * 4 !== path.color.length) {
          console.warn('errornous color (x.length * 4 !== color.length) detected');
          return;
        }

        idx8 = 0;
        for (let i=0; i<path.color.length; i+=4) {
          vertColor[ptsIdx8 + idx8 + 0] = path.color[i];
          vertColor[ptsIdx8 + idx8 + 1] = path.color[i + 1];
          vertColor[ptsIdx8 + idx8 + 2] = path.color[i + 2];
          vertColor[ptsIdx8 + idx8 + 3] = path.color[i + 3];
          vertColor[ptsIdx8 + idx8 + 4] = path.color[i];
          vertColor[ptsIdx8 + idx8 + 5] = path.color[i + 1];
          vertColor[ptsIdx8 + idx8 + 6] = path.color[i + 2];
          vertColor[ptsIdx8 + idx8 + 7] = path.color[i + 3];
          idx8 += 8;
        }
      }

      const convertedWidth = Math.floor(Math.max(1, Math.min(255.0, path.width || prop.width)) * 256);
      idx2 = 0;
      for (let i=0; i<path.x.length; i++) {
        vertWidth[ptsIdx2 + idx2] = convertedWidth;
        vertWidth[ptsIdx2 + idx2 + 1] = convertedWidth;
        idx2 += 2;
      }

      idx2=0;
      idx4=0;
      idx6=0;
      const nPts = path.x.length;
      let dx=0, dy=0, dl=0;
      for (let i=0; i<path.x.length; i++) {
        vertDirection[ptsIdx2 + idx2] = +1;
        vertDirection[ptsIdx2 + idx2 + 1] = 0;

        vertPositions[ptsIdx6 + idx6 + 0] = path.x[i];
        vertPositions[ptsIdx6 + idx6 + 1] = path.y[i];
        vertPositions[ptsIdx6 + idx6 + 2] = 0;
        vertPositions[ptsIdx6 + idx6 + 3] = path.x[i];
        vertPositions[ptsIdx6 + idx6 + 4] = path.y[i];
        vertPositions[ptsIdx6 + idx6 + 5] = 0;
        if (i > 0) {
          dx = path.x[i] - path.x[i-1];
          dy = path.y[i] - path.y[i-1];
          dl = Math.sqrt(dx * dx + dy * dy);
          if (dl === 0) dl = 1.0;
          vertTgntA[ptsIdx4 + idx4] = dx / dl;
          vertTgntA[ptsIdx4 + idx4 + 1] = dy / dl; 
          vertTgntA[ptsIdx4 + idx4 + 2] = dx / dl;
          vertTgntA[ptsIdx4 + idx4 + 3] = dy / dl; 
        } else if (closedPath) {
          dx = path.x[i] - path.x[nPts-2];
          dy = path.y[i] - path.y[nPts-2];
          dl = Math.sqrt(dx * dx + dy * dy);
          if (dl === 0) dl = 1.0;
          vertTgntA[ptsIdx4 + idx4] = dx / dl;
          vertTgntA[ptsIdx4 + idx4 + 1] = dy / dl; 
          vertTgntA[ptsIdx4 + idx4 + 2] = dx / dl;
          vertTgntA[ptsIdx4 + idx4 + 3] = dy / dl; 
        } else {
          dx = 0;
          dy = 0;
          dl = 0;
        }
        if (dl > 0 && i > 0) {
          const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) / Math.PI * 2;
          const angleHistIdx = Math.floor(angle * (numAngleHist - 1) + 0.5);
          cumLenHist[numAngleHist * (ptsIdx + i) + angleHistIdx] = dl;
        }
        idx2 += 2;
        idx4 += 4;
        idx6 += 6;
      }

      for (let i=1; i<path.x.length; i++) {
        const baseIdx = numAngleHist * (ptsIdx + i);
        for (let j=0; j < numAngleHist; j++) {
          cumLenHist[baseIdx + j] += cumLenHist[baseIdx - numAngleHist + j];
        }
      }

      idx4=0;
      for (let i=0; i<path.x.length; i++) {
        if (i < nPts - 1) {
          vertTgntB[ptsIdx4 + idx4]     = vertTgntA[ptsIdx4 + idx4 + 4];
          vertTgntB[ptsIdx4 + idx4 + 1] = vertTgntA[ptsIdx4 + idx4 + 5];
          vertTgntB[ptsIdx4 + idx4 + 2] = vertTgntA[ptsIdx4 + idx4 + 6];
          vertTgntB[ptsIdx4 + idx4 + 3] = vertTgntA[ptsIdx4 + idx4 + 7];
        } else if (closedPath) {
          vertTgntB[ptsIdx4 + idx4] = vertTgntA[ptsIdx4 + 4];
          vertTgntB[ptsIdx4 + idx4 + 1] = vertTgntA[ptsIdx4 + 5];
          vertTgntB[ptsIdx4 + idx4 + 2] = vertTgntA[ptsIdx4 + 6];
          vertTgntB[ptsIdx4 + idx4 + 3] = vertTgntA[ptsIdx4 + 7];
        }
        idx4 += 4;
      }

      idx2 = 0;
      idx6 = 0;
      for (let i=0; i< (path.x.length - 1); i++) {
        vertIndices[triangleIdx + idx6]     = ptsIdx2 + idx2 + 0;
        vertIndices[triangleIdx + idx6 + 1] = ptsIdx2 + idx2 + 1;
        vertIndices[triangleIdx + idx6 + 2] = ptsIdx2 + idx2 + 2;
        vertIndices[triangleIdx + idx6 + 3] = ptsIdx2 + idx2 + 1;
        vertIndices[triangleIdx + idx6 + 4] = ptsIdx2 + idx2 + 3;
        vertIndices[triangleIdx + idx6 + 5] = ptsIdx2 + idx2 + 2;
        idx2 += 2;
        idx6 += 6;
      }
      triangleIdx += (path.x.length - 1) * 6;

      ptsIdx += path.x.length;
    });

    let maxCumLenHist = 1e-8;
    for (let i=0; i<cumLenHist.length; i++) {
      if (maxCumLenHist < cumLenHist[i]) maxCumLenHist = cumLenHist[i];
    }
    for (let i=0; i<cumLenHist.length; i++) cumLenHist[i] /= maxCumLenHist;

    return [vertPositions, vertColor, vertWidth, vertTgntA, vertTgntB, vertDirection, cumLenHist, maxCumLenHist, vertIndices, vertPointId];
  }, [prop.paths]);


  const shaderData = React.useMemo(()=>{
    const data = {
      transparent: true,
      uniforms: {
        uCumLenHist: { value: new THREE.Texture() },
        uMaxCumLenHist : {value: 1.0},
        uNumPoints: { value: 1},
        uNumHistsPerRow : { value: 1},
        uNumHistsRows: { value: 1},
        uLineWidth: { value: 1.0 },
        uZOffset: {value: 0.0},
        uCanvasSize: { value: new THREE.Vector2(100, 100)},
        uChartRegionBottomLeft: { value: new THREE.Vector2(-1.0, -1.0)},
        uChartRegionSize: { value: new THREE.Vector2(2.0, 2.0)},
        uVisibleRangeBottomLeft: { value: new THREE.Vector2(-1.0, -1.0) }, // x1, y1, x2, y2
        uVisibleRangeSize: { value: new THREE.Vector2(0.5, 0.5) }, // 1 / w, 1 / h
        uSharedLineColor: { value: new THREE.Vector4(0, 0, 0, 0) }, // RGBA
        uPatternSize: {value: 10},
        uTexture: { value: (()=>{ 
          const texture = new THREE.Texture(); 
          texture.needsUpdate = true;
          return texture; 
        })()},
      },
      vertexShader: `
precision mediump float;
uniform float uLineWidth;
uniform float uZOffset;
uniform vec2 uCanvasSize;
uniform vec2 uChartRegionBottomLeft;
uniform vec2 uChartRegionSize;
uniform vec2 uVisibleRangeSize;
uniform vec2 uVisibleRangeBottomLeft;
uniform vec4 uSharedLineColor;

uniform sampler2D uCumLenHist;
uniform float uMaxCumLenHist;
uniform int uNumPoints;
uniform float uNumHistsPerRow;
uniform float uNumHistsRows;

attribute vec3 position;
attribute vec2 tgntA;
attribute vec2 tgntB;
attribute vec4 color;
attribute float direction;
attribute float width;
attribute float pointId;

varying vec4 vLineColor;
varying float vPixelLength;

vec2 normal(vec2 tgnt) {
  return vec2(-tgnt.y, tgnt.x);
}

vec2 bevel_edge(vec2 ta, vec2 tb) {
  vec2 t = ta * tb;
  vec2 tdir = normalize(ta + tb);
  vec2 ndir = normal(tdir);

  float inner_prod = t.x + t.y;
  float dist_inv = sqrt(0.5 * (1.01 + inner_prod));
  if (dist_inv < 0.33) dist_inv = 0.33;
  return ndir / dist_inv;
}

void main() {
  if (color.w == 0.0) {
    vLineColor = uSharedLineColor;
  }
  else {
    vLineColor = color;
  }

  float curLineWidth = uLineWidth;
  if (width > 0.0) {
    curLineWidth = width * 256.0;
  }

  vPixelLength = 0.0;
  
  float curDir = (direction - 0.5) * 2.0;

  vec2 pts = (position.xy - uVisibleRangeBottomLeft) / uVisibleRangeSize;
  vec2 corTgntA = normalize(tgntA / uVisibleRangeSize * uChartRegionSize * uCanvasSize);
  vec2 corTgntB = normalize(tgntB / uVisibleRangeSize * uChartRegionSize * uCanvasSize);
  gl_Position.xy = pts * uChartRegionSize + uChartRegionBottomLeft;
  if (tgntA == vec2(0.0, 0.0)) {
    gl_Position.xy += curLineWidth * normal(corTgntB) * curDir / uCanvasSize;
  } else if (tgntB == vec2(0.0, 0.0)){
    gl_Position.xy += curLineWidth * normal(corTgntA) * curDir / uCanvasSize;
  } else {
    gl_Position.xy += curLineWidth * bevel_edge(corTgntA, corTgntB) * curDir / uCanvasSize;
  }
  gl_Position.zw = vec2(uZOffset, 1.0);

   
  for (int i=0; i<${numAngleHist}; i++) {
    float th = float(i) * 1.570796 / ${numAngleHist - 1}.0;
    vec2 tv = vec2(cos(th), sin(th)) * uChartRegionSize * uCanvasSize / uVisibleRangeSize;
    float rowIdx = floor(pointId / uNumHistsPerRow);
    float colIdx = pointId - rowIdx * uNumHistsPerRow;
    vec2 pidx = (vec2(colIdx * float(${numAngleHist}) + float(i), rowIdx) + 0.5) / 
                 vec2(float(${numAngleHist}) * uNumHistsPerRow, uNumHistsRows);
    float lorig = texture2D(uCumLenHist, pidx).r * uMaxCumLenHist;
    vPixelLength += length(tv) * lorig;
  }
}`,
      fragmentShader: `precision mediump float;

uniform sampler2D uTexture;
uniform float uPatternSize;

varying vec4 vLineColor;
varying float vPixelLength;

uniform vec2 uChartRegionBottomLeft;
uniform vec2 uChartRegionSize;
uniform vec2 uCanvasSize;

void main() {
  vec2 fragCoord = gl_FragCoord.xy / uCanvasSize * 2.0 - 1.0;
  if (fragCoord.x < uChartRegionBottomLeft.x) discard; 
  if (fragCoord.x > (uChartRegionBottomLeft.x + uChartRegionSize.x)) discard;
  if (fragCoord.y < uChartRegionBottomLeft.y) discard;
  if (fragCoord.y > (uChartRegionBottomLeft.y + uChartRegionSize.y)) discard;

  float off = abs(vPixelLength) / uPatternSize;
  float pos = off - floor(off);
  vec4 chosenColor = texture2D(uTexture, vec2(pos, 0.99));
  gl_FragColor.xyz = vLineColor.xyz;
  gl_FragColor.w = vLineColor.w * chosenColor.w;
}`

    };
    return data;
  }, []);

  React.useEffect(()=>{
    if (shaderRef.current) {
      shaderRef.current.uniforms.uCanvasSize = {value: new THREE.Vector2(
        threeCtx.size.width,
        threeCtx.size.height,
      )};
      if (dashPatternTexture) {
        shaderRef.current.uniforms.uTexture = {value: dashPatternTexture };
      }
      shaderRef.current.uniforms.uLineWidth = {value: prop.width};
      shaderRef.current.uniforms.uPatternSize = {value: patternSize};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [threeCtx.size, dashPatternTexture]);

  React.useEffect(()=>{
    const visibleRange = chartViewInfo.visibleRange;
    if (shaderRef.current) {
      shaderRef.current.uniforms.uVisibleRangeSize = {value: new THREE.Vector2(
        Math.abs(visibleRange[2] - visibleRange[0]),
        Math.abs(visibleRange[3] - visibleRange[1]),
      )};
      shaderRef.current.uniforms.uVisibleRangeBottomLeft = {value: new THREE.Vector2(
        visibleRange[0],
        visibleRange[1],
      )}
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [chartViewInfo.visibleRange])

  React.useEffect(()=>{
    const chartRegion = chartViewInfo.chartRegion;
    if (shaderRef.current) {
      shaderRef.current.uniforms.uChartRegionBottomLeft = {value: new THREE.Vector2(
        chartRegion[0] * 2.0 - 1.0, 1.0 - chartRegion[3] * 2.0
      )};
      shaderRef.current.uniforms.uChartRegionSize = {value: new THREE.Vector2(
        (chartRegion[2] - chartRegion[0]) * 2.0,
        (chartRegion[3] - chartRegion[1]) * 2.0,
      )}
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [chartViewInfo.chartRegion])

  React.useEffect(()=>{
    if (shaderRef.current) {
      shaderRef.current.uniforms.uSharedLineColor = {value: sharedLineColor};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [sharedLineColor]);

  React.useEffect(()=>{
    if (shaderRef.current) {
      const zOffset = (prop.zOrder)? 0.5 + 0.45 * Math.tanh(prop.zOrder): 0.5;
      shaderRef.current.uniforms.uZOffset= {value: zOffset};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [prop.zOrder])

  React.useEffect(()=>{
    if (shaderRef.current) {
      const numHistsPerRow = Math.floor(maxTextureWidth / numAngleHist);
      const textureWidth = numHistsPerRow * numAngleHist;
      const numHistsRows = Math.ceil(numPoints / numHistsPerRow);

      const texture = new THREE.DataTexture(cumLenHist, textureWidth, numHistsRows,
        THREE.RedFormat, THREE.FloatType);
      texture.magFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      shaderRef.current.uniforms.uCumLenHist = {value: texture}; 
      shaderRef.current.uniforms.uMaxCumLenHist = {value: maxCumLenHist}; 
      shaderRef.current.uniforms.uNumPoints = { value: numPoints };
      shaderRef.current.uniforms.uNumHistsPerRow = { value: numHistsPerRow };
      shaderRef.current.uniforms.uNumHistsRows = { value: numHistsRows };
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [prop.paths]);

  const meshRef = React.useRef<THREE.Mesh>(null);

  if (prop.paths.length === 0) return <></>;

  return (
    <mesh ref={meshRef}>
      <bufferGeometry >
        <bufferAttribute attach="index" count={vertIndices.length} array={vertIndices} itemSize={1}  usage={THREE.DynamicDrawUsage}/>
        <bufferAttribute attach="attributes-position" count={vertPositions.length / 3} array={vertPositions} itemSize={3}  usage={THREE.DynamicDrawUsage}/>
        <bufferAttribute attach="attributes-color" count={vertColor.length / 4} array={vertColor} itemSize={4} normalized  usage={THREE.DynamicDrawUsage}/>
        <bufferAttribute attach="attributes-width" count={vertWidth.length} array={vertWidth} itemSize={1}  normalized  usage={THREE.DynamicDrawUsage}/>
        <bufferAttribute attach="attributes-tgntA" count={vertTgntA.length / 2} array={vertTgntA} itemSize={2}  usage={THREE.DynamicDrawUsage}/>
        <bufferAttribute attach="attributes-tgntB" count={vertTgntB.length / 2} array={vertTgntB} itemSize={2}  usage={THREE.DynamicDrawUsage}/>
        <bufferAttribute attach="attributes-direction" count={vertDirection.length} array={vertDirection} itemSize={1}  usage={THREE.DynamicDrawUsage}/>
        <bufferAttribute attach="attributes-pointId" count={vertPointId.length} array={vertPointId} itemSize={1}  usage={THREE.DynamicDrawUsage}/>
      </bufferGeometry>
      <rawShaderMaterial attach="material" ref={shaderRef} {...shaderData} />
    </mesh>
  );
}

export default ChartStyledPathGroup;