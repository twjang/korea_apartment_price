import * as React from 'react';
import * as THREE from 'three';
import { ChartObjectProp } from '../types';
import { useThree } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
import { makeArrayFromNumber } from '../utils';
import { fromDashType } from '../textureBuilder/fromDashType';
import { useChartViewInfo } from '../utils/ChartViewContext';


export type Line = {
  x: number
  y: number
  dx: number
  dy: number
  color?: number // Override the default color. repeated [r, g, b, a] values.
  width?: number // Override the default width. max 255.
}

export type ChartLineGroupProp = {
  lines: Line[];
  width: number; // size in pixel
  color: number;
  dashType?: number[];
} & ChartObjectProp;



export const ChartLineGroup = (prop:ChartLineGroupProp)=>{
  const [dashPatternTexture, setDashPatternTexture] = React.useState<THREE.DataTexture | null>(null);
  const [patternSize, setPatternSize] = React.useState<number | null>(null);
  const threeCtx = useThree();
  const shaderRef = React.useRef<ShaderMaterial>(null);
  const chartViewInfo = useChartViewInfo();

  React.useEffect(()=>{
    (async () => {
      const textures = await fromDashType({dash: {pattern: prop.dashType || [15, 10]}});
      setDashPatternTexture(textures.texture);
      setPatternSize(textures.patternSize['dash']);
    })();
  }, [prop.dashType]);

  const sharedLineColor = React.useMemo<THREE.Vector4>(()=>{
    const t = makeArrayFromNumber(prop.color, 1.0 / 255.0);
    const fillColor = new THREE.Vector4(t[0], t[1], t[2], t[3]);
    return fillColor;
  }, [prop.color]);

  const numLines = prop.lines.length;
  /*
        O     We have (2 vertices) * (2 ends) = 4 vertices per line
      /  \    
    O     \   
     \     \

    This figure shows the locations of each of point indices 
        <---------- (dx, dy) direction    
        1 ------------------------------------- 2   
        |       |                               |  
        |       | Normal direction              |   
        |       V                               |  
        0---------------------------------------3

  */

  const [useLineSpecificColor, useLineSpecificWidth] = React.useMemo<[boolean, boolean]>(()=>{
    let useColor = false;
    let useWidth = false;
    prop.lines.forEach(line=>{ 
      if (line.color !== undefined) useColor = true;
      if (line.width !== undefined) useWidth = true;
    });
    return [useColor, useWidth]
  }, [prop.lines])
     
  const [vertPositions, vertColor, vertWidth, vertPointId, vertIndices] = React.useMemo<[
    Float32Array, Uint8Array, Uint16Array, Float32Array, Uint32Array
  ]>(() => {
    const vertPositions = new Float32Array(numLines * 4 * 4);
    const vertColor = (useLineSpecificColor)? new Uint8Array(numLines * 4 * 4): new Uint8Array(1);
    const vertWidth = (useLineSpecificWidth)? new Uint16Array(numLines * 4): new Uint16Array(1);
    const vertPointId = new Float32Array(numLines * 4);
    const vertIndices = new Uint32Array(numLines * 6);

    let idx4=0;
    let idx6=0;
    let idx16=0;

    for (let i=0; i<numLines; i++) {
      const curLine = prop.lines[i];

      vertPointId[idx4] = 0;
      vertPointId[idx4 + 1] = 1;
      vertPointId[idx4 + 2] = 2;
      vertPointId[idx4 + 3] = 3;

      const curX = curLine.x;
      const curY = curLine.y;
      let curdX  = curLine.dx;
      let curdY  = curLine.dy;

      if (curdX > 0.0) {
        curdX = -curdX;
        curdY = -curdY;
      } 

      for (let j=0; j<16; j+=4) {
        vertPositions[idx16 + j]     = curX;
        vertPositions[idx16 + j + 1] = curY;
        vertPositions[idx16 + j + 2] = curdX;
        vertPositions[idx16 + j + 3] = curdY;
      }

      if (curLine.color !== undefined) {
        const curColor = makeArrayFromNumber(curLine.color);
        for (let j=0; j<16; j+=4) {
          vertColor[idx16 + j]     = curColor[0];
          vertColor[idx16 + j + 1] = curColor[1];
          vertColor[idx16 + j + 2] = curColor[2];
          vertColor[idx16 + j + 3] = curColor[3];
        }
      }

      if (curLine.width !== undefined) {
        for (let j=0; j<4; j++) {
          vertWidth[idx4 + j] = curLine.width * 256;
        }
      }

      vertIndices[idx6    ] = idx4 + 0;
      vertIndices[idx6 + 1] = idx4 + 2;
      vertIndices[idx6 + 2] = idx4 + 1;
      vertIndices[idx6 + 3] = idx4 + 3;
      vertIndices[idx6 + 4] = idx4 + 2;
      vertIndices[idx6 + 5] = idx4 + 0;

      idx4 += 4;
      idx6 += 6;
      idx16 += 16;
    }

    return [vertPositions, vertColor, vertWidth, vertPointId, vertIndices];
  }, [prop.lines, numLines]);


  const shaderData = React.useMemo(()=>{
    const data = {
      transparent: true,
      uniforms: {
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
uniform float uZOffset;
uniform vec2 uCanvasSize;
uniform vec2 uCanvasSizeInv;
uniform vec2 uChartRegionBottomLeft;
uniform vec2 uChartRegionSize;
uniform vec2 uVisibleRangeSizeInv;
uniform vec2 uVisibleRangeBottomLeft;
uniform vec4 uSharedLineColor;

attribute vec4  position;
attribute vec4  color;
attribute float width;

attribute float pointId; 

varying vec4 vLineColor;
varying float vPixelLength;

vec2 normal(vec2 tgnt) {
  return vec2(-tgnt.y, tgnt.x);
}

/* edge id
 ----0----
 |       |
 1       3
 |       |
 ----2---- 
 result: (1 if there is a solution. otherwise 0, ...[coordinates of the solution])
*/

vec3 solve_line(vec2 pt, vec2 tgnt, int edge) {
  float sol = 0.0;
  if (edge == 0) {
    if (tgnt.y == 0.0) return vec3(0.0, 0.0, 0.0);
    sol = pt.x + tgnt.x / tgnt.y * (1.0 - pt.y);
    if (0.0 <= sol && sol <= 1.0) 
      return vec3(1.0, sol, 1.0);
  } else if (edge == 1) {
    if (tgnt.x == 0.0) return vec3(0.0, 0.0, 0.0);
    sol = pt.y - tgnt.y / tgnt.x * pt.x;
    if (0.0 <= sol && sol <= 1.0) 
      return vec3(1.0, 0.0, sol);
  } else if (edge == 2) {
    if (tgnt.y == 0.0) return vec3(0.0, 0.0, 0.0); 
    sol = pt.x - tgnt.x / tgnt.y * pt.y;
    if (0.0 <= sol && sol <= 1.0) 
      return vec3(1.0, sol, 0.0);
  } else {
    if (tgnt.x == 0.0) return  vec3(0.0, 0.0, 0.0);
    sol = pt.y + tgnt.y / tgnt.x * (1.0 - pt.x);
    if (0.0 <= sol && sol <= 1.0) 
      return vec3(1.0, 1.0, sol);
  }
  return vec3(0.0, 0.0, 0.0);
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

  // pt is visible if it resides within (0,0)-(1,1) box
  // tgnt and normVec are vectors in the same space as pt.
  // That is, to convert them to the NDC, we multiply uChartRegionSize to these vectors.

  vec2 pt   = (position.xy - uVisibleRangeBottomLeft) * uVisibleRangeSizeInv;
  vec2 tgnt = position.zw * uVisibleRangeSizeInv;
  vec2 normVec = normal(normalize(tgnt * uChartRegionSize * uCanvasSize)) * curLineWidth * 0.5 * uCanvasSizeInv / uChartRegionSize;  

  vec2 ptCur = pt;
  if (pointId == 0.0 || pointId == 3.0) {
    ptCur = pt + normVec;
  } else {
    ptCur = pt - normVec;
  }

  vec2 pt1 = vec2(0.0, 0.0);
  vec2 pt2 = vec2(0.0, 0.0);

  for (int i=0; i < 4; i++) {
    vec3 curSol1 = solve_line(ptCur, tgnt, i);
    if (curSol1.x > 0.0) {
      pt1 = curSol1.yz;
      for (int j=1; j < 4; j++) {
        int edgeIdx = i + j;
        if (edgeIdx >= 4) edgeIdx -= 4;
        vec3 curSol2 = solve_line(ptCur, tgnt, edgeIdx);
        if (curSol2.x > 0.0) {
          pt2 = curSol2.yz;
          break;
        }
      }
      break;
    }
  }

  gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
  vec2 finalPt = vec2(0.0, 0.0);
  
  vec2 checkSameDir = (pt1 - pt2) * position.zw;
  bool dir = (checkSameDir.x + checkSameDir.y) > 0.0;

  if (dir && pointId < 1.5 || !dir && pointId > 1.5) {
    // start point
    finalPt = pt1 * uChartRegionSize + uChartRegionBottomLeft;
    vPixelLength = 0.0; 
  } else {
    finalPt = pt2 * uChartRegionSize + uChartRegionBottomLeft;
    vec2 pixelDist = ((pt2 - pt1) * uCanvasSize);
    vPixelLength = length(pixelDist);
  }

  gl_Position.xy = finalPt;
  gl_Position.zw = vec2(uZOffset, 1.0);

}`,
      fragmentShader: `precision lowp float;

uniform sampler2D uTexture;
uniform float uPatternSize;

uniform vec2 uChartRegionBottomLeft;
uniform vec2 uChartRegionSize;
uniform vec2 uCanvasSize;

varying vec4 vLineColor;
varying float vPixelLength;

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
  // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
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
      }
      shaderRef.current.uniforms.uLineWidth = {value: prop.width};
      shaderRef.current.uniforms.uPatternSize = {value: patternSize};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [shaderRef.current, threeCtx.size, dashPatternTexture]);

  React.useEffect(()=>{
    const visibleRange = chartViewInfo.visibleRange;
    if (shaderRef.current) {
      shaderRef.current.uniforms.uVisibleRangeSizeInv = {value: new THREE.Vector2(
        1.0 / Math.abs(visibleRange[2] - visibleRange[0]),
        1.0 / Math.abs(visibleRange[3] - visibleRange[1]),
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
  }, [shaderRef.current, sharedLineColor]);

  React.useEffect(()=>{
    if (shaderRef.current) {
      const zOffset = (prop.zOrder)? 0.5 + 0.45 * Math.tanh(prop.zOrder): 0.5;
      shaderRef.current.uniforms.uZOffset= {value: zOffset};
      shaderRef.current.uniformsNeedUpdate=true;
    }
  }, [prop.zOrder])

  const meshRef = React.useRef<THREE.Mesh>(null);
  const geometry = React.useRef<THREE.BufferGeometry>(null);

  return (
    <mesh ref={meshRef}>
      <bufferGeometry ref={geometry} >
        <bufferAttribute attach="index" count={vertIndices.length} array={vertIndices} itemSize={1} />
        <bufferAttribute attach="attributes-position" count={vertPositions.length / 4} array={vertPositions} itemSize={4} />
        {useLineSpecificColor? 
        <bufferAttribute attach="attributes-color" count={vertColor.length / 4} array={vertColor} itemSize={4} normalized />: <></>}
        {useLineSpecificWidth? 
        <bufferAttribute attach="attributes-width" count={vertWidth.length} array={vertWidth} itemSize={1}  normalized />: <></>}
        <bufferAttribute attach="attributes-pointId" count={vertPointId.length} array={vertPointId} itemSize={1} />
      </bufferGeometry>
      <rawShaderMaterial attach="material" ref={shaderRef} {...shaderData} />
    </mesh>
  );
}

export default ChartLineGroup;