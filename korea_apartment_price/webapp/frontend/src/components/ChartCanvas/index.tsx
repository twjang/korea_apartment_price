import * as React from 'react';
import * as THREE from 'three'
import {ThreeEvent} from '@react-three/fiber/dist/declarations/src/core/events';

import { useMemo, useRef, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ChartPointGroup } from './objects/PointGroup';

class DotMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      transparent: true,
      uniforms: { size: { value: 15 }, scale: { value: 1 } },
      vertexShader: THREE.ShaderLib.points.vertexShader,
      fragmentShader: `
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, step(length(gl_PointCoord.xy - vec2(0.5)), 0.5));
      }`,
    })
  }
}



const white = new THREE.Color('white')
const hotpink = new THREE.Color('hotpink')
function Particles({ pointCount }: any) {
  const [positions, colors] = useMemo(() => {
    const positions = [...new Array(pointCount * 3)].map(() => 5 - Math.random() * 10)
    const colors = [...new Array(pointCount)].flatMap(() => hotpink.toArray())
    return [new Float32Array(positions), new Float32Array(colors)]
  }, [pointCount])

  const points = useRef<THREE.Points>(null!)
  const hover = useCallback((e:ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    white.toArray(points.current.geometry.attributes.color.array, e.index! * 3)
    points.current.geometry.attributes.color.needsUpdate = true
  }, [])

  const unhover = useCallback((e: ThreeEvent<PointerEvent>) => {
    hotpink.toArray(points.current.geometry.attributes.color.array, e.index! * 3)
    points.current.geometry.attributes.color.needsUpdate = true
  }, [])

      // <dotMaterial vertexColors depthWrite={false} />
  return (
    <points ref={points} onPointerOver={hover} onPointerOut={unhover}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </bufferGeometry>
    </points>
  )
}

export function ChartDemo2() {
  const size = 8;
  const numPts = 100;
  const [ptsX, setPtsX] = React.useState<Float32Array | null>(null);
  const [ptsY, setPtsY] = React.useState<Float32Array | null>(null);

  React.useEffect(()=>{
    const x = new Float32Array(numPts);
    const y = new Float32Array(numPts);
    for (let i=0; i<numPts; i++) {
      x[i] = (Math.random() - 0.5);
      y[i] = (Math.random() * 0.1) + Math.sin(x[i]);
    }
    setPtsX(x);
    setPtsY(y);
  }, []);

  return (
    <Canvas
      orthographic
      camera={{ zoom: 40, position: [0, 0, 100] }}
      raycaster={{ params: { Points: { threshold: 0.2 } } }}>
      <Particles pointCount={1000} />
    </Canvas>
  )
}

function Thing() {

const fragmentShader = `
  varying vec3 Normal;
  varying vec3 Position;

  uniform vec3 Ka;
  uniform vec3 Kd;
  uniform vec3 Ks;
  uniform vec4 LightPosition;
  uniform vec3 LightIntensity;
  uniform float Shininess;

  vec3 phong() {
    vec3 n = normalize(Normal);
    vec3 s = normalize(vec3(LightPosition) - Position);
    vec3 v = normalize(vec3(-Position));
    vec3 r = reflect(-s, n);

    vec3 ambient = Ka;
    vec3 diffuse = Kd * max(dot(s, n), 0.0);
    vec3 specular = Ks * pow(max(dot(r, v), 0.0), Shininess);

    return LightIntensity * (ambient + diffuse + specular);
  }

  void main() {
    vec3 blue = vec3(0.0, 0.0, 1.0);
    gl_FragColor = vec4(blue*phong(), 1.0);
}`

const vertexShader = `
  varying vec3 Normal;
  varying vec3 Position;

  void main() {
    Normal = normalize(normalMatrix * normal);
    Position = vec3(modelViewMatrix * vec4(position, 1.0));
    gl_Position = modelViewMatrix * vec4(position, 1.0);
  }
`
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {if (ref.current)ref.current.rotation.x = ref.current.rotation.y += 0.01; })

  const data = useMemo(
    () => ({
      uniforms: {
        Ka: { value: new THREE.Vector3(1, 1, 1) },
        Kd: { value: new THREE.Vector3(1, 1, 1) },
        Ks: { value: new THREE.Vector3(1, 1, 1) },
        LightIntensity: { value: new THREE.Vector4(0.5, 0.5, 0.5, 1.0) },
        LightPosition: { value: new THREE.Vector4(0.0, 2000.0, 0.0, 1.0) },
        Shininess: { value: 200.0 }
      },
      fragmentShader,
      vertexShader
    }),
    []
  )
  const geometry = React.useRef<THREE.BoxGeometry>(null);
  console.log('box', geometry.current);
  return (
    <mesh ref={ref}>
      <boxGeometry ref={geometry} args={[1, 1, 1]} />
      <shaderMaterial {...data} />
    </mesh>
  )
}

export default function ChartDemo() {
  const size = 8;
  const numPts = 50000;

  const [ptsX, ptsY, ptsSize] = React.useMemo<[Float32Array, Float32Array, number]>(()=>{
    const x = new Float32Array(numPts);
    const y = new Float32Array(numPts);
    for (let i=0; i<numPts; i++) {
      x[i] = (Math.random() - 0.5) * 2.0;
      y[i] = (Math.random() * 0.5) + Math.sin(x[i]);
    }
    return [x, y, 12];
  }, []);
  
  const camera = React.useMemo<THREE.OrthographicCamera>(()=>{
    return new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  }, []);

  return (
    <Canvas orthographic camera={camera}>
      <ChartPointGroup x={ptsX} y={ptsY} size={ptsSize}
        fillColor={0xFFFF00FF} 
        borderColor={0x000000FF}
        borderWidth={2}
        visibleRange={[-1.0, -1.0, 1.0, 1.0]}
        chartRegion={[0.2, 0.2, 0.8, 0.8]}
        markerType="triangle" />
    </Canvas>
  )

  return (
    <Canvas camera={camera}>
      <Thing />
    </Canvas>
  )
}