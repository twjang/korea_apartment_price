import * as React from 'react';
import * as THREE from 'three';
import { ChartObjectProp } from '../types';
import { useThree } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
import { makeArrayFromNumber } from '../utils';
import { fromDashType } from '../textureBuilder/fromDashType';


export type Path = {
  x: Float32Array
  y: Float32Array
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
  lineWidth: number // size in pixel
  lineColor: number;
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
  const [dashPatternTexture, setDashPatternTexture] = React.useState<THREE.DataTexture | null>(null);
  const [patternSize, setPatternSize] = React.useState<number | null>(null);
  const threeCtx = useThree();
  const shaderRef = React.useRef<ShaderMaterial>(null);


  React.useEffect(()=>{
    (async () => {
      const textures = await fromDashType({dash: {pattern: prop.dashType || [5, 5]}});
      console.log(textures);
      setDashPatternTexture(textures.texture);
      setPatternSize(textures.patternSize['dash']);
    })();
  }, [prop.dashType]);

  const sharedLineColor = React.useMemo<THREE.Vector4>(()=>{
    const t = makeArrayFromNumber(prop.lineColor, 1.0 / 255.0);
    const fillColor = new THREE.Vector4(t[0], t[1], t[2], t[3]);
    return fillColor;
  }, [prop.lineColor]);


  const numPoints = React.useMemo<number>(()=>{
    let cnt = 0;
    prop.paths.forEach(path=>{ 
      if (path.x.length < 2 || path.x.length !== path.y.length)
        return;
      cnt += path.x.length;
    });
    return cnt;
  }, [prop.paths]);
     
  const [vertPositions, vertTgntA, vertTgntB, vertDirection, cumLenHist, maxCumLenHist, vertIndices, vertCumLenId] = React.useMemo<[
    Float32Array, Float32Array, Float32Array, Uint8Array, Float32Array, number, Uint32Array, Float32Array
  ]>(() => {
    const vertPositions = new Float32Array(numPoints * 6);
    const vertTgntA = new Float32Array(numPoints * 4);
    const vertTgntB = new Float32Array(numPoints * 4);
    const vertDirection = new Uint8Array(numPoints * 2);
    const vertIndices = new Uint32Array(numPoints * 6);
    const vertCumLenId = new Float32Array(numPoints * 2);
    const cumLenHist: Float32Array = (()=> {
      const numHistsPerRow = Math.floor(maxTextureWidth / numAngleHist);
      const numHistsRows = Math.ceil(numPoints / numHistsPerRow);
      return new Float32Array(numAngleHist * numHistsRows * numHistsPerRow);
    })();


    for (let i=0; i<numPoints; i++) {
      vertCumLenId[2 * i] = i;
      vertCumLenId[2 * i + 1] = i;
    }

    let ptsIdx = 0;
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

      let idx2=0;
      let idx4=0;
      let idx6=0;

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
        vertIndices[ptsIdx6 + idx6]     = ptsIdx2 + idx2 + 0;
        vertIndices[ptsIdx6 + idx6 + 1] = ptsIdx2 + idx2 + 1;
        vertIndices[ptsIdx6 + idx6 + 2] = ptsIdx2 + idx2 + 2;
        vertIndices[ptsIdx6 + idx6 + 3] = ptsIdx2 + idx2 + 1;
        vertIndices[ptsIdx6 + idx6 + 4] = ptsIdx2 + idx2 + 3;
        vertIndices[ptsIdx6 + idx6 + 5] = ptsIdx2 + idx2 + 2;
        idx2 += 2;
        idx6 += 6;
      }

      ptsIdx += path.x.length;
    });

    let maxCumLenHist = 1e-8;
    for (let i=0; i<cumLenHist.length; i++) {
      if (maxCumLenHist < cumLenHist[i]) maxCumLenHist = cumLenHist[i];
    }
    for (let i=0; i<cumLenHist.length; i++) cumLenHist[i] /= maxCumLenHist;

    return [vertPositions, vertTgntA, vertTgntB, vertDirection, cumLenHist, maxCumLenHist, vertIndices, vertCumLenId];
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
        uCanvasSizeInv: { value: new THREE.Vector2(0.01, 0.01)},
        uChartRegionBottomLeft: { value: new THREE.Vector2(-1.0, -1.0)},
        uChartRegionSize: { value: new THREE.Vector2(2.0, 2.0)},
        uVisibleRangeBottomLeft: { value: new THREE.Vector2(-1.0, -1.0) }, // x1, y1, x2, y2
        uVisibleRangeSizeInv: { value: new THREE.Vector2(0.5, 0.5) }, // 1 / w, 1 / h
        uSharedLineColor: { value: new THREE.Vector4(0, 0, 0, 0) }, // RGBA
        uPatternSize: {value: 10},
        uTexture: { value: (()=>{ 
          const texture = new THREE.Texture(); 
          texture.needsUpdate = true;
          return texture; 
        })()},
      },
      vertexShader: `
precision lowp float;
uniform float uLineWidth;
uniform vec2 uCanvasSize;
uniform vec2 uCanvasSizeInv;
uniform vec2 uChartRegionBottomLeft;
uniform vec2 uChartRegionSize;
uniform vec2 uVisibleRangeSizeInv;
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
attribute float direction;
attribute float cumLenId;

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
  vLineColor = uSharedLineColor;
  vPixelLength = 0.0;
  
  float curDir = (direction - 0.5) * 2.0;
  vec2 widthVec = uLineWidth * uCanvasSizeInv;

  vec2 pts = (position.xy - uVisibleRangeBottomLeft) * uVisibleRangeSizeInv;
  if (0.0 <= pts.x && pts.x <= 1.0 && 0.0 <= pts.y && pts.y <= 1.0) {
    vec2 corTgntA = normalize(tgntA * uVisibleRangeSizeInv * uChartRegionSize * uCanvasSize);
    vec2 corTgntB = normalize(tgntB * uVisibleRangeSizeInv * uChartRegionSize * uCanvasSize);
    gl_Position.xy = pts * uChartRegionSize + uChartRegionBottomLeft;
    if (tgntA == vec2(0.0, 0.0)) {
      gl_Position.xy += uLineWidth * normal(corTgntB) * curDir * uCanvasSizeInv;
    } else if (tgntB == vec2(0.0, 0.0)){
      gl_Position.xy += uLineWidth * normal(corTgntA) * curDir * uCanvasSizeInv;
    } else {
      gl_Position.xy += uLineWidth * bevel_edge(corTgntA, corTgntB) * curDir * uCanvasSizeInv;
    }
    gl_Position.zw = vec2(0.0, 1.0);
  } else {
    gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
  }

   
  for (int i=0; i<${numAngleHist}; i++) {
    float th = float(i) * 1.570796 / ${numAngleHist - 1}.0;
    vec2 tv = vec2(cos(th), sin(th)) * uVisibleRangeSizeInv * uChartRegionSize * uCanvasSize;
    float rowIdx = floor(cumLenId / uNumHistsPerRow);
    float colIdx = cumLenId - rowIdx * uNumHistsPerRow;
    vec2 pidx = (vec2(colIdx * float(${numAngleHist}) + float(i), rowIdx) + 0.5) / 
                 vec2(float(${numAngleHist}) * uNumHistsPerRow, uNumHistsRows);
    float lorig = texture2D(uCumLenHist, pidx).r * uMaxCumLenHist;
    vPixelLength += length(tv) * lorig;
  }
}`,
      fragmentShader: `precision lowp float;

uniform sampler2D uTexture;
uniform float uPatternSize;

varying vec4 vLineColor;
varying float vPixelLength;

void main() {
  float off = abs(vPixelLength) / uPatternSize;
  float pos = off - floor(off);
  vec4 chosenColor = texture2D(uTexture, vec2(pos, 0.99));
  gl_FragColor.xyz = vLineColor.xyz;
  gl_FragColor.w = chosenColor.w;
}`

    };
    return data;
  }, []);

  React.useEffect(()=>{
    if (shaderRef.current) {
      shaderRef.current.uniforms.uCanvasSizeInv = {value: new THREE.Vector2(
        1.0 / threeCtx.size.width,
        1.0 / threeCtx.size.height,
      )};
      shaderRef.current.uniforms.uCanvasSize = {value: new THREE.Vector2(
        threeCtx.size.width,
        threeCtx.size.height,
      )};
      if (dashPatternTexture) {
        shaderRef.current.uniforms.uTexture = {value: dashPatternTexture };
        console.log(dashPatternTexture);
      }
      shaderRef.current.uniforms.uLineWidth = {value: prop.lineWidth};
      shaderRef.current.uniforms.uPatternSize = {value: patternSize};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [shaderRef.current, threeCtx.size, dashPatternTexture]);

  React.useEffect(()=>{
    if (shaderRef.current) {
      shaderRef.current.uniforms.uVisibleRangeSizeInv = {value: new THREE.Vector2(
        1.0 / Math.abs(prop.visibleRange[2] - prop.visibleRange[0]),
        1.0 / Math.abs(prop.visibleRange[3] - prop.visibleRange[1]),
      )};
      shaderRef.current.uniforms.uVisibleBottomLeft = {value: new THREE.Vector2(
        prop.visibleRange[0],
        prop.visibleRange[3],
      )}
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [prop.visibleRange])

  React.useEffect(()=>{
    if (shaderRef.current) {
      shaderRef.current.uniforms.uChartRegionBottomLeft = {value: new THREE.Vector2(
        prop.chartRegion[0] * 2.0 - 1.0, 1.0 - prop.chartRegion[3] * 2.0
      )};
      shaderRef.current.uniforms.uChartRegionSize = {value: new THREE.Vector2(
        (prop.chartRegion[2] - prop.chartRegion[0]) * 2.0,
        (prop.chartRegion[3] - prop.chartRegion[1]) * 2.0,
      )}
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [prop.chartRegion])

  React.useEffect(()=>{
    if (shaderRef.current) {
      shaderRef.current.uniforms.uSharedLineColor = {value: sharedLineColor};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [shaderRef.current, sharedLineColor]);

  React.useEffect(()=>{
    if (shaderRef.current) {
      const zOffset = (prop.zOrder)? 1 + 0.5 * Math.tanh(prop.zOrder): 0.0;
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
  const geometry = React.useRef<THREE.BufferGeometry>(null);
  const boxgeometry = React.useRef<THREE.BoxGeometry>(null);

  console.log({
    vertIndices,
    vertPositions,
    vertTgntA,
    vertTgntB,
    vertDirection,
    cumLenHist,
  })


  return (
    <mesh ref={meshRef}>
      <bufferGeometry ref={geometry} >
        <bufferAttribute attach="index" count={vertIndices.length} array={vertIndices} itemSize={1} />
        <bufferAttribute attach="attributes-position" count={vertPositions.length / 3} array={vertPositions} itemSize={3} />
        <bufferAttribute attach="attributes-tgntA" count={vertTgntA.length / 2} array={vertTgntA} itemSize={2} />
        <bufferAttribute attach="attributes-tgntB" count={vertTgntB.length / 2} array={vertTgntB} itemSize={2} />
        <bufferAttribute attach="attributes-direction" count={vertDirection.length} array={vertDirection} itemSize={1} />
        <bufferAttribute attach="attributes-cumLenId" count={vertCumLenId.length} array={vertCumLenId} itemSize={1} />
      </bufferGeometry>
      <rawShaderMaterial attach="material" ref={shaderRef} {...shaderData} />
    </mesh>
  );
}

/*
      <planeGeometry attach="geometry" args={[2, 2]} />
      {dashPatternTexture?
      <meshBasicMaterial attach="material" map={cumLenHistTexture} transparent />
      :<></>}

      <bufferGeometry ref={geometry} >
        <bufferAttribute attach="index" count={vertIndices.length} array={vertIndices} itemSize={1} />
        <bufferAttribute attach="attributes-position" count={vertPositions.length / 3} array={vertPositions} itemSize={3} />
        <bufferAttribute attach="attributes-tgntA" count={vertTgntA.length / 2} array={vertTgntA} itemSize={2} />
        <bufferAttribute attach="attributes-tgntB" count={vertTgntB.length / 2} array={vertTgntB} itemSize={2} />
        <bufferAttribute attach="attributes-direction" count={vertDirection.length} array={vertDirection} itemSize={1} />
        <bufferAttribute attach="attributes-cumLenId" count={vertVertexId.length} array={vertVertexId} itemSize={1} />
      </bufferGeometry>
      <rawShaderMaterial attach="material" ref={shaderRef} {...shaderData} />
*/