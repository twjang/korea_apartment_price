import * as React from 'react';
import * as THREE from 'three';
import { ChartObjectProp } from '../types';
import { useThree } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
import { makeArrayFromNumber } from '../utils';
import { useChartViewInfo } from '../utils/ChartViewContext';

export type Contour = {
  x: Float32Array;
  y: Float32Array;
};

export type FilledArea = {
  contour: Contour;
  holes?: Contour[];
  color?: number;
};

export type ChartFilledAreaGroupProp = {
  filledArea: FilledArea[];
  color: number;
  textureAsPattern?: boolean; // default: false
  texture?: THREE.Texture;
  repeatPeriod?: [number, number];
} & ChartObjectProp;

type ThreeAreaDef = {
  contour: THREE.Vector2[];
  holes: THREE.Vector2[][];
};

export const ChartFilledAreaGroup = (prop: ChartFilledAreaGroupProp) => {
  const threeCtx = useThree();
  const chartViewInfo = useChartViewInfo();

  const shaderRef = React.useRef<ShaderMaterial>(null);
  const useVertexColor = React.useMemo<boolean>(() => {
    let vertexCustomColor = false;
    prop.filledArea.forEach((area) => {
      if (area.color !== undefined) vertexCustomColor = true;
    });
    return !prop.textureAsPattern && vertexCustomColor;
  }, [prop.filledArea]);

  const [vertPositions, vertIndices, vertColors] = React.useMemo<
    [Float32Array, Uint32Array, Uint8Array]
  >(() => {
    const ptsCoords: number[] = [];
    const ptsColors: [number, number[]][] = []; // list of (count, color value)
    const indices: number[] = [];

    prop.filledArea.forEach((area) => {
      const curArea: ThreeAreaDef = {
        contour: [],
        holes: [],
      };

      for (let i = 0; i < area.contour.x.length; i++) {
        const v = new THREE.Vector2(area.contour.x[i], area.contour.y[i]);
        curArea.contour.push(v);
      }

      if (area.holes) {
        area.holes.forEach((hole) => {
          const curHole: THREE.Vector2[] = [];
          for (let i = 0; i < hole.x.length; i++) {
            const v = new THREE.Vector2(hole.x[i], hole.y[i]);
            curHole.push(v);
          }
          curArea.holes.push(curHole);
        });
      }

      const curIndices = THREE.ShapeUtils.triangulateShape(
        curArea.contour,
        curArea.holes
      );
      const baseIdx = Math.floor(ptsCoords.length / 2);

      for (let i = 0; i < curArea.contour.length; i++) {
        const x = curArea.contour[i].x;
        const y = curArea.contour[i].y;
        ptsCoords.push(x);
        ptsCoords.push(y);
        ptsCoords.push(0);
      }

      for (let i = 0; i < curArea.holes.length; i++) {
        const curHole = curArea.holes[i];
        for (let j = 0; j < curHole.length; j++) {
          ptsCoords.push(curHole[j].x);
          ptsCoords.push(curHole[j].y);
          ptsCoords.push(0);
        }
      }

      for (let i = 0; i < curIndices.length; i++) {
        const curTriInd = curIndices[i];
        indices.push(baseIdx + curTriInd[0]);
        indices.push(baseIdx + curTriInd[1]);
        indices.push(baseIdx + curTriInd[2]);
      }

      if (useVertexColor) {
        const cnt = ptsCoords.length / 2 - baseIdx;
        if (area.color) {
          ptsColors.push([cnt, makeArrayFromNumber(area.color)]);
        } else {
          ptsColors.push([cnt, makeArrayFromNumber(prop.color)]);
        }
      }
    });

    const vertPositions = new Float32Array(ptsCoords);
    const vertIndices = new Uint32Array(indices);
    const vertColors = useVertexColor
      ? new Uint8Array((ptsCoords.length / 3) * 4)
      : new Uint8Array(0);

    if (useVertexColor) {
      let idx4 = 0;
      ptsColors.forEach(([cnt, colorValue]) => {
        for (let i = 0; i < cnt; i++) {
          vertColors[idx4] = colorValue[0];
          vertColors[idx4 + 1] = colorValue[1];
          vertColors[idx4 + 2] = colorValue[2];
          vertColors[idx4 + 3] = colorValue[3];
          idx4 += 4;
        }
      });
    }

    return [vertPositions, vertIndices, vertColors];
  }, [prop.filledArea]);

  const shaderData = React.useMemo(() => {
    const data = {
      transparent: true,
      uniforms: {
        uUseTexture: { value: 0.0 },
        uUseVertexColor: { value: 0.0 },
        uUseTextureAsPattern: { value: 0.0 },
        uSharedColor: { value: new THREE.Vector4(0.0, 1.0, 0.0, 1.0) },
        uZOffset: { value: 0.0 },
        uRepeatPeriod: { value: new THREE.Vector2(10, 10) },
        uCanvasSize: { value: new THREE.Vector2(100, 100) },
        uChartRegionBottomLeft: { value: new THREE.Vector2(-1.0, -1.0) },
        uChartRegionSize: { value: new THREE.Vector2(2.0, 2.0) },
        uVisibleRangeSize: { value: new THREE.Vector2(0.5, 0.5) }, // 1 / w, 1 / h
        uVisibleRangeBottomLeft: { value: new THREE.Vector2(-1.0, -1.0) }, // x1, y1, x2, y2
        uTexture: {
          value: (() => {
            const texture = new THREE.Texture();
            return texture;
          })(),
        },
      },
      vertexShader: `
precision mediump float;
uniform vec4 uSharedColor;
uniform float uZOffset;
uniform float uUseVertexColor;
uniform vec2 uRepeatPeriod;
uniform vec2 uCanvasSize;
uniform vec2 uChartRegionBottomLeft;
uniform vec2 uChartRegionSize;
uniform vec2 uVisibleRangeSize;
uniform vec2 uVisibleRangeBottomLeft;

attribute vec3 position;
attribute vec4 color;

varying vec4 vColor;
varying vec2 vUv;

void main() {
  if (uUseVertexColor > 0.0 && color.w > 0.0) {
    vColor = color;
  } else {
    vColor = uSharedColor;
  }

  vec2 pts = (position.xy - uVisibleRangeBottomLeft) / uVisibleRangeSize;
  vec2 ndsPts = pts * uChartRegionSize + uChartRegionBottomLeft;
  vec2 texturePts = pts * uChartRegionSize * uCanvasSize / uRepeatPeriod;

  gl_Position.xy = ndsPts;
  vUv = texturePts;
  gl_Position.zw = vec2(uZOffset, 1.0);
}
`,
      fragmentShader: `precision mediump float;

uniform sampler2D uTexture;
uniform float uUseTextureAsPattern; 
uniform float uUseTexture; 

uniform vec2 uChartRegionBottomLeft;
uniform vec2 uChartRegionSize;
uniform vec2 uCanvasSize;

varying vec4 vColor;
varying vec2 vUv;

void main() {
  vec2 fragCoord = gl_FragCoord.xy / uCanvasSize * 2.0 - 1.0;
  if (fragCoord.x < uChartRegionBottomLeft.x) discard; 
  if (fragCoord.x > (uChartRegionBottomLeft.x + uChartRegionSize.x)) discard;
  if (fragCoord.y < uChartRegionBottomLeft.y) discard;
  if (fragCoord.y > (uChartRegionBottomLeft.y + uChartRegionSize.y)) discard;
  
  if (uUseTexture > 0.0) {
    vec4 chosenColor = texture2D(uTexture, vUv - floor(vUv));
    if (uUseTextureAsPattern > 0.0) {
      gl_FragColor.xyz = vColor.xyz;
      gl_FragColor.w = vColor.w * chosenColor.r;
    } else {
      gl_FragColor = chosenColor;
    }
  } else {
    gl_FragColor = vColor;
  }
}`,
    };
    return data;
  }, []);

  React.useEffect(() => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uCanvasSize = {
        value: new THREE.Vector2(threeCtx.size.width, threeCtx.size.height),
      };
      if (prop.texture) {
        shaderRef.current.uniforms.uTexture = { value: prop.texture };
        shaderRef.current.uniforms.uUseTexture = { value: 1.0 };
        shaderRef.current.uniforms.uUseTextureAsPattern = {
          value: prop.textureAsPattern ? 1.0 : 0.0,
        };
      } else {
        shaderRef.current.uniforms.uTexture = { value: new THREE.Texture() };
        shaderRef.current.uniforms.uUseTexture = { value: 0.0 };
        shaderRef.current.uniforms.uUseTextureAsPattern = {
          value: 0.0,
        };
      }
      shaderRef.current.uniforms.uUseVertexColor = {
        value: useVertexColor ? 1.0 : 0.0,
      };
      shaderRef.current.uniformsNeedUpdate = true;
    }
  }, [threeCtx.size, prop]);

  React.useEffect(() => {
    const visibleRange = chartViewInfo.visibleRange;
    if (shaderRef.current) {
      shaderRef.current.uniforms.uVisibleRangeSize = {
        value: new THREE.Vector2(
          Math.abs(visibleRange[2] - visibleRange[0]),
          Math.abs(visibleRange[3] - visibleRange[1])
        ),
      };
      shaderRef.current.uniforms.uVisibleRangeBottomLeft = {
        value: new THREE.Vector2(visibleRange[0], visibleRange[1]),
      };
      shaderRef.current.uniformsNeedUpdate = true;
    }
  }, [chartViewInfo.visibleRange]);

  React.useEffect(() => {
    const chartRegion = chartViewInfo.chartRegion;
    if (shaderRef.current) {
      shaderRef.current.uniforms.uChartRegionBottomLeft = {
        value: new THREE.Vector2(
          chartRegion[0] * 2.0 - 1.0,
          1.0 - chartRegion[3] * 2.0
        ),
      };
      shaderRef.current.uniforms.uChartRegionSize = {
        value: new THREE.Vector2(
          (chartRegion[2] - chartRegion[0]) * 2.0,
          (chartRegion[3] - chartRegion[1]) * 2.0
        ),
      };
      shaderRef.current.uniformsNeedUpdate = true;
    }
  }, [chartViewInfo.chartRegion]);

  React.useEffect(() => {
    if (shaderRef.current) {
      const c = makeArrayFromNumber(prop.color, 1 / 255.0);
      shaderRef.current.uniforms.uSharedColor = {
        value: new THREE.Vector4(c[0], c[1], c[2], c[3]),
      };
      shaderRef.current.uniformsNeedUpdate = true;
    }
  }, [prop.color]);

  React.useEffect(() => {
    if (shaderRef.current) {
      const zOffset = prop.zOrder ? 0.5 + 0.45 * Math.tanh(prop.zOrder) : 0.5;
      shaderRef.current.uniforms.uZOffset = { value: zOffset };
      shaderRef.current.uniformsNeedUpdate = true;
    }
  }, [prop.zOrder]);

  const meshRef = React.useRef<THREE.Mesh>(null);

  if (prop.filledArea.length === 0) return <></>;

  return (
    <mesh ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="index"
          count={vertIndices.length}
          array={vertIndices}
          itemSize={1}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-position"
          count={vertPositions.length / 3}
          array={vertPositions}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
        {useVertexColor && (
          <bufferAttribute
            attach="attributes-color"
            count={vertColors.length / 4}
            array={vertColors}
            itemSize={4}
            normalized
            usage={THREE.DynamicDrawUsage}
          />
        )}
      </bufferGeometry>
      <rawShaderMaterial attach="material" ref={shaderRef} {...shaderData} />
    </mesh>
  );
};

export default ChartFilledAreaGroup;
