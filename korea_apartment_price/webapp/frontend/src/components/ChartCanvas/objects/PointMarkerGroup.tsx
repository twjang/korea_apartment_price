import * as React from 'react';
import * as THREE from 'three';
import { ChartObjectProp, MarkerType } from '../types';
import { getSVGMarker } from '../utils/svgMarkerLib';
import { fromSVGs } from '../textureBuilder/fromSVGs';
import { useThree } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
import { makeArrayFromNumber } from '../utils';


export type ChartPointMarkerGroupProp = {
  x: Float32Array
  y: Float32Array
  size: number // size in pixel
  fillColor: Uint8Array | number // RGBA
  borderColor?: Uint8Array | number // RGBA
  borderWidth?: number
  markerType?: MarkerType
} & ChartObjectProp;

export const ChartPointMarkerGroup = (prop:ChartPointMarkerGroupProp)=>{
  const numPoints = prop.x.length;
  const [markerTexture, setMarkerTexture] = React.useState<THREE.DataTexture | null>(null);
  const threeCtx = useThree();
  const shaderRef = React.useRef<ShaderMaterial>(null);
  const useSharedFillColor = (typeof prop.fillColor === 'number')
  const useSharedBorderColor = (!prop.borderColor || (typeof prop.borderColor === 'number'));

  React.useEffect(()=>{
    (async () => {
      const markerType = (prop.markerType) ? prop.markerType : 'o';
      const svgMarker = getSVGMarker(markerType, {
        lineWidth: prop.borderWidth, lineColor: '#FF0000', fillColor: '#00FF00', size: prop.size
      });
      const textures = await fromSVGs({ 'marker': { svg: svgMarker } });
      setMarkerTexture(textures.texture);
    })();
  }, [prop.markerType, prop.borderWidth]);

  const [sharedFillColor, sharedBorderColor] = React.useMemo<[THREE.Vector4, THREE.Vector4]>(()=>{
    let fillColor = new THREE.Vector4(0.0, 0.0, 0.0, 0.0);
    let borderColor = new THREE.Vector4(0.0, 0.0, 0.0, 0.0);

    if (typeof prop.fillColor === 'number') {
      const t = makeArrayFromNumber(prop.fillColor, 1.0 / 255.0);
      fillColor = new THREE.Vector4(t[0], t[1], t[2], t[3]);
    }

    if (typeof prop.borderColor === 'number') {
      const t = makeArrayFromNumber(prop.borderColor, 1.0 / 255.0);
      borderColor = new THREE.Vector4(t[0], t[1], t[2], t[3]);
    }

    return [fillColor, borderColor];
  }, [prop.fillColor, prop.borderColor]);
     
  const [vertPositions, vertUV] = React.useMemo<[Float32Array, Float32Array]>(() => {
    console.assert(numPoints === prop.y.length, 'y buffer has different length');

    const vertPositions = new Float32Array(numPoints * 3 * 4);
    const vertUV = new Float32Array(numPoints * 2 * 4);

    for (let i = 0; i < numPoints; i++) {
      let idx8 = i * 8;
      let idx12 = i * 12;
      for (let j = 0; j < 12; j += 3) {
        vertPositions[idx12 + j] = prop.x[i];
        vertPositions[idx12 + j + 1] = prop.y[i];
        vertPositions[idx12 + j + 2] = 0;
      }
      vertUV[idx8 + 0] = 0.0; vertUV[idx8 + 1] = 1.0;
      vertUV[idx8 + 2] = 1.0; vertUV[idx8 + 3] = 1.0;
      vertUV[idx8 + 4] = 0.0; vertUV[idx8 + 5] = 0.0;
      vertUV[idx8 + 6] = 1.0; vertUV[idx8 + 7] = 0.0;
    }
    return [vertPositions, vertUV];
  }, [prop.x, prop.y]);

  const vertFillColor = React.useMemo<Uint8Array>(() => {
    const converted = new Uint8Array(numPoints * 16);
    if (typeof prop.fillColor !== 'number')
      console.assert(numPoints * 4 === prop.fillColor.length, 'fillColor buffer has different length');
    if (!useSharedFillColor) {
      for (let i = 0; i < numPoints; i++) {
        let idx16 = i * 16;
        for (let j=0; j < 16; j+= 4) {
          for (let k=0; k < 4; k++) {
            converted[idx16 + j + k] = (prop.fillColor as Uint8Array)[i+k];
          }
        }
      }
    }
    return converted;
  }, [prop.fillColor]);

  const vertBorderColor = React.useMemo<Uint8Array>(() => {
    const converted = new Uint8Array(numPoints * 16);
    if (typeof prop.borderColor !== 'number' && prop.borderColor)
      console.assert(numPoints * 4 === prop.borderColor.length, 'fillColor buffer has different length');
    if (!useSharedBorderColor) {
      for (let i = 0; i < numPoints; i++) {
        let idx16 = i * 16;
        for (let j=0; j < 16; j+= 4) {
          for (let k=0; k < 4; k++) {
            converted[idx16 + j + k] = (prop.borderColor as Uint8Array)[i+k];
          }
        }
      }
    }
    return converted;
  }, [prop.borderColor]);

  const vertIndices = React.useMemo<Uint32Array>(() => {
    const vertIndices = new Uint32Array(numPoints * 6);
    for (let i = 0; i < numPoints; i++) {
      let idx6 = i * 6;
      let idx4 = i * 4;
      vertIndices[idx6 + 0] = idx4 + 0;
      vertIndices[idx6 + 1] = idx4 + 2;
      vertIndices[idx6 + 2] = idx4 + 1;
      vertIndices[idx6 + 3] = idx4 + 2;
      vertIndices[idx6 + 4] = idx4 + 3;
      vertIndices[idx6 + 5] = idx4 + 1;
    }
    return vertIndices;
  }, [prop.x, prop.y]);

  const shaderData = React.useMemo(()=>{
    const data = {
      transparent: true,
      uniforms: {
        uSize: { value: 1.0 },
        uZOffset: {value: 0.0},
        uCanvasSizeInv: { value: new THREE.Vector2(0.01, 0.01)},
        uChartRegionBottomLeft: { value: new THREE.Vector2(-1.0, -1.0)},
        uChartRegionSize: { value: new THREE.Vector2(2.0, 2.0)},
        uVisibleRangeBottomLeft: { value: new THREE.Vector2(-1.0, -1.0) }, // x1, y1, x2, y2
        uVisibleRangeSizeInv: { value: new THREE.Vector2(0.5, 0.5) }, // 1 / w, 1 / h
        uSharedFillColor: { value: new THREE.Vector4(0, 0, 0, 0) }, // RGBA
        uSharedBorderColor: { value: new THREE.Vector4(0, 0, 0, 0) }, // RGBA
        uTexture: { value: new THREE.Texture()},
      },
      vertexShader: `
precision lowp float;
uniform float uSize;
uniform float uZOffset;
uniform vec2 uCanvasSizeInv;
uniform vec2 uChartRegionBottomLeft;
uniform vec2 uChartRegionSize;
uniform vec2 uVisibleRangeSizeInv;
uniform vec2 uVisibleRangeBottomLeft;
uniform vec4 uSharedFillColor;
uniform vec4 uSharedBorderColor;

attribute vec3 position;
attribute vec2 uv;
attribute vec4 borderColor;
attribute vec4 fillColor;

varying vec2 vUv;
varying vec4 vFillColor;
varying vec4 vBorderColor;

void main() {
  vUv = uv;
  if (uSharedFillColor.w > 0.0) vFillColor = uSharedFillColor;
  else vFillColor = fillColor;

  if (uSharedBorderColor.w > 0.0) vBorderColor = uSharedBorderColor;
  else vBorderColor = borderColor;
  
  vec2 pts = (position.xy - uVisibleRangeBottomLeft) * uVisibleRangeSizeInv;
  if (0.0 <= pts.x && pts.x <= 1.0 && 0.0 <= pts.y && pts.y <= 1.0) {
    gl_Position.xy = pts * uChartRegionSize + uChartRegionBottomLeft;
    gl_Position.xy += (uv - vec2(0.5, 0.5)) * uSize * uCanvasSizeInv * 2.0;
    gl_Position.z = uZOffset;
    gl_Position.w = 1.0;
  } else {
    gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
  }
}`,
      fragmentShader: `precision lowp float;

uniform sampler2D uTexture;

varying vec2 vUv;
varying vec4 vFillColor;
varying vec4 vBorderColor;

void main() {
  vec4 chosenColor = texture2D(uTexture, vUv);
  float pBorder = chosenColor.x;  
  float pFill = chosenColor.y; 
  vec4 vFill = vec4(pFill, pFill, pFill, pFill);
  vec4 vBorder = vec4(pBorder, pBorder, pBorder, pBorder);
  gl_FragColor = vFill * vFillColor + vBorder * vBorderColor;
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
      if (markerTexture) {
        shaderRef.current.uniforms.uTexture = {value: markerTexture };
      }
      shaderRef.current.uniforms.uSize = {value: prop.size};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [shaderRef.current, threeCtx.size, markerTexture]);

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
      const zOffset = (prop.zOrder)? 0.5 + 0.45 * Math.tanh(prop.zOrder): 0.5;
      shaderRef.current.uniforms.uZOffset= {value: zOffset};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [prop.zOrder])

  React.useEffect(()=>{
    if (shaderRef.current) {
      shaderRef.current.uniforms.uSharedFillColor = {value: sharedFillColor};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [shaderRef.current, prop.fillColor]);

  React.useEffect(()=>{
    if (shaderRef.current) {
      shaderRef.current.uniforms.uSharedBorderColor = {value: sharedBorderColor};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [shaderRef.current, prop.borderColor]);

  const mesh = React.useRef<THREE.Mesh>(null);
  const geometry = React.useRef<THREE.BufferGeometry>(null);
  return (
    <mesh ref={mesh}>
      <bufferGeometry ref={geometry} >
        <bufferAttribute attach="index" count={vertIndices.length} array={vertIndices} itemSize={1} />
        <bufferAttribute attach="attributes-position" count={vertPositions.length / 3} array={vertPositions} itemSize={3} />
        <bufferAttribute attach="attributes-uv" count={vertUV.length / 2} array={vertUV} itemSize={2} />
        {useSharedBorderColor?
        <bufferAttribute attach="attributes-borderColor" count={vertBorderColor.length / 3} array={vertBorderColor} itemSize={3} />: <></>}
        {useSharedFillColor?
        <bufferAttribute attach="attributes-fillColor" count={vertFillColor.length / 2} array={vertFillColor} itemSize={2} />: <></>}
      </bufferGeometry>
      <rawShaderMaterial attach="material" ref={shaderRef} {...shaderData} />
    </mesh>
  );
}

