import * as React from 'react';

import { Canvas } from '@react-three/fiber';
import { ChartViewContext } from './utils/ChartViewContext';
import useRefWithCallback from '../../misc/useRefWithCallback';

export type ChartClickEvent = {
  x: number;
  y: number;
  visibleRange: [number, number, number, number];
};

export type LabelInfo = {
  value: number;
  rotation?: number;
  label: JSX.Element;
};

export type ChartCanvasProp = {
  chartRegion: [number, number, number, number];
  maxZoom?: [number, number];
  dataRange: [number, number, number, number];
  defaultVisibleRange?: [number, number, number, number];
  children?: (JSX.Element | null)[] | JSX.Element;
  xAxisLabels?: (range: [number, number]) => LabelInfo[];
  yAxisLabels?: (range: [number, number]) => LabelInfo[];
  gridColor?: string;
  gridWidth?: number;
  onClick?: (e: ChartClickEvent) => unknown;
};

const clip = (a: number, b: number, x: number): number => {
  [a, b] = [Math.min(a, b), Math.max(a, b)];
  return Math.max(a, Math.min(b, x));
};

const clientCoordToDataCoord = (
  prop: ChartCanvasProp,
  eventCoord: [number, number],
  canvasSize: [number, number],
  visibleRange: [number, number, number, number]
): [number, number] | null => {
  const [w, h] = canvasSize;
  const [x, y] = eventCoord;
  const relX =
    (x / w - prop.chartRegion[0]) / (prop.chartRegion[2] - prop.chartRegion[0]);
  const relY =
    1.0 -
    (y / h - prop.chartRegion[1]) / (prop.chartRegion[3] - prop.chartRegion[1]);
  if (relX < 0.0 || relX > 1.0 || relY < 0.0 || relY > 1.0) return null;
  const dataX = visibleRange[0] + relX * (visibleRange[2] - visibleRange[0]);
  const dataY = visibleRange[1] + relY * (visibleRange[3] - visibleRange[1]);
  return [dataX, dataY];
};

const clientCoordToChartCoord = (
  prop: ChartCanvasProp,
  eventCoord: [number, number],
  canvasSize: [number, number]
): [number, number] | null => {
  const [w, h] = canvasSize;
  const [x, y] = eventCoord;
  const relX =
    (x / w - prop.chartRegion[0]) / (prop.chartRegion[2] - prop.chartRegion[0]);
  const relY =
    1.0 -
    (y / h - prop.chartRegion[1]) / (prop.chartRegion[3] - prop.chartRegion[1]);
  if (relX < 0.0 || relX > 1.0 || relY < 0.0 || relY > 1.0) return null;
  return [relX, relY];
};

type HTMLPlacerProp = {
  children: JSX.Element | JSX.Element[];
  x: number;
  y: number;
  transforms?: string[];
};

const HTMLPlacer = (prop: HTMLPlacerProp) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: prop.y,
        left: prop.x,
        ...((prop.transforms)?{ transform: prop.transforms.join(' ') }: {}),
      }}
    >
      {prop.children}
    </div>
  );
};

const defaultLabelGenerator = (range: [number, number]): LabelInfo[] => {
  const tick = Math.pow(10, Math.floor(Math.log10(range[1] - range[0]) - 0.5));
  const startIdx = Math.ceil(range[0] / tick);
  const endIdx = Math.floor(range[1] / tick);
  const res: LabelInfo[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const value = i * tick;
    res.push({
      value,
      label: (
        <>
          {parseFloat(`${value}`)
            .toPrecision(10)
            .replace(/[.]?0*$/, '')}
        </>
      ),
    });
  }
  return res;
};

const getOffset = (
  e: React.PointerEvent | React.WheelEvent | React.MouseEvent | WheelEvent
): [number, number] => {
  const rect = (e.target as HTMLDivElement).getBoundingClientRect();
  return [e.clientX - rect.x, e.clientY - rect.y];
};

const ChartCanvas = (prop: ChartCanvasProp) => {
  const [visibleRange, setVisibleRange] = React.useState<
    [number, number, number, number]
  >(prop.defaultVisibleRange ? prop.defaultVisibleRange : prop.dataRange);

  const [canvasSize, setCanvasSize] = React.useState<[number, number] | null>(
    null
  );

  const [frameRef, setFrameRef] = useRefWithCallback<HTMLDivElement>((frame)=>{
    frame.addEventListener('wheel', handleWheel, {passive: false});
    window.addEventListener('resize', canvasSizeUpdater);
  }, (frame)=>{
    frame.removeEventListener('wheel', handleWheel);
    window.removeEventListener('resize', canvasSizeUpdater);
  });

  const canvasSizeUpdater = ()=>{
    if (frameRef.current) {
      setCanvasSize([
        frameRef.current.clientWidth,
        frameRef.current.clientHeight,
      ]);
    }
  }
  React.useEffect(()=>{
    canvasSizeUpdater();
  }, []);

  const handleWheel = (e: WheelEvent) => {
    if (!canvasSize) return;

    e.stopPropagation();
    e.preventDefault();

    const eventCoord = clientCoordToDataCoord(
      prop,
      getOffset(e),
      canvasSize,
      visibleRange
    );
    if (!eventCoord) return;

    let dx1 = visibleRange[0] - eventCoord[0];
    let dy1 = visibleRange[1] - eventCoord[1];
    let dx2 = visibleRange[2] - eventCoord[0];
    let dy2 = visibleRange[3] - eventCoord[1];

    if (e.deltaY < 0) {
      const scale = 0.9;
      if (e.ctrlKey) {
        dy1 *= scale;
        dy2 *= scale;
      } else if (e.shiftKey) {
        dx1 *= scale;
        dx2 *= scale;
      } else {
        dx1 *= scale;
        dy1 *= scale;
        dx2 *= scale;
        dy2 *= scale;
      }

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
      const scale = 1.1;
      if (e.ctrlKey) {
        dy1 *= scale;
        dy2 *= scale;
      } else if (e.shiftKey) {
        dx1 *= scale;
        dx2 *= scale;
      } else {
        dx1 *= scale;
        dy1 *= scale;
        dx2 *= scale;
        dy2 *= scale;
      }
    }

    const newVisibleRange: [number, number, number, number] = [
      clip(prop.dataRange[0], prop.dataRange[2], dx1 + eventCoord[0]),
      clip(prop.dataRange[1], prop.dataRange[3], dy1 + eventCoord[1]),
      clip(prop.dataRange[0], prop.dataRange[2], dx2 + eventCoord[0]),
      clip(prop.dataRange[1], prop.dataRange[3], dy2 + eventCoord[1]),
    ];
    setVisibleRange(newVisibleRange);
  };

  const [pointerAnchors, setPointerAnchors] = React.useState<
    Record<string, { x: number; y: number }>
  >({});
  const [currentPointers, setCurrentPointers] = React.useState<
    Record<string, { x: number; y: number }>
  >({});
  const [visibleRangeSnapshot, setVisibleRangeSnapshot] =
    React.useState<[number, number, number, number]>(visibleRange);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canvasSize) return;

    const relCoord = clientCoordToChartCoord(prop, getOffset(e), canvasSize);
    if (!relCoord) return;
    const [x, y] = relCoord;

    const newCurrentPointers = Object.assign({}, currentPointers);
    newCurrentPointers[e.pointerId] = { x, y };

    setPointerAnchors(newCurrentPointers);
    setCurrentPointers(newCurrentPointers);
    setVisibleRangeSnapshot(visibleRange);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!canvasSize) return;

    if (prop.onClick) {
      const eventCoord = clientCoordToDataCoord(
        prop,
        getOffset(e),
        canvasSize,
        visibleRange
      );
      if (!eventCoord) return;

      prop.onClick({
        x: eventCoord[0],
        y: eventCoord[1],
        visibleRange,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!canvasSize) return;

    if (pointerAnchors[e.pointerId]) {
      const relCoord = clientCoordToChartCoord(prop, getOffset(e), canvasSize);
      if (!relCoord) return;
      const [x, y] = relCoord;

      setCurrentPointers((ptr) => {
        return { ...ptr, [e.pointerId]: { x, y } };
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerAnchors[e.pointerId]) {
      const newPointerAnchors = Object.assign({}, currentPointers);
      if (newPointerAnchors[e.pointerId]) delete newPointerAnchors[e.pointerId];
      setPointerAnchors(newPointerAnchors);
    }

    if (currentPointers[e.pointerId]) {
      const newCurrentPointers = Object.assign({}, currentPointers);
      delete newCurrentPointers[e.pointerId];
      setCurrentPointers(newCurrentPointers);
    }

    setVisibleRangeSnapshot(visibleRange);
  };

  React.useEffect(() => {
    if (
      Object.keys(currentPointers).length !== Object.keys(pointerAnchors).length
    )
      return;

    const numPointers = Object.keys(currentPointers).length;
    if (numPointers === 1) {
      const pointerId = Object.keys(pointerAnchors)[0];
      const p1 = pointerAnchors[pointerId];
      const p2 = currentPointers[pointerId];
      const newW = visibleRangeSnapshot[2] - visibleRangeSnapshot[0];
      const newH = visibleRangeSnapshot[3] - visibleRangeSnapshot[1];
      const newX0 = clip(
        prop.dataRange[0],
        prop.dataRange[2] - newW,
        (p1.x - p2.x) * newW + visibleRangeSnapshot[0]
      );
      const newY0 = clip(
        prop.dataRange[1],
        prop.dataRange[3] - newH,
        (p1.y - p2.y) * newH + visibleRangeSnapshot[1]
      );

      const newVisibleRange: [number, number, number, number] = [
        newX0,
        newY0,
        newX0 + newW,
        newY0 + newH,
      ];
      setVisibleRange(newVisibleRange);
    } else if (numPointers === 2) {
      const [pointerId1, pointerId2] = Object.keys(pointerAnchors);
      const p11 = pointerAnchors[pointerId1];
      const p12 = currentPointers[pointerId1];
      const p21 = pointerAnchors[pointerId2];
      const p22 = currentPointers[pointerId2];

      const onlyYZoom =
        Math.abs(p11.x - p12.x) < 0.1 && Math.abs(p21.x - p22.x) < 0.1;
      const onlyXZoom =
        Math.abs(p11.y - p12.y) < 0.1 && Math.abs(p21.y - p22.y) < 0.1;
      const oldW = visibleRangeSnapshot[2] - visibleRangeSnapshot[0];
      const oldH = visibleRangeSnapshot[3] - visibleRangeSnapshot[1];

      const newW = onlyYZoom
        ? oldW
        : clip(
            prop.maxZoom?.at(0) || 0,
            prop.dataRange[2] - prop.dataRange[0],
            Math.abs(
              ((visibleRangeSnapshot[2] - visibleRangeSnapshot[0]) *
                (p21.x - p11.x)) /
                (p22.x - p12.x)
            )
          );
      const newH = onlyXZoom
        ? oldH
        : clip(
            prop.maxZoom?.at(1) || 0,
            prop.dataRange[3] - prop.dataRange[1],
            Math.abs(
              ((visibleRangeSnapshot[3] - visibleRangeSnapshot[1]) *
                (p21.y - p11.y)) /
                (p22.y - p12.y)
            )
          );

      const newX0 = clip(
        prop.dataRange[0],
        prop.dataRange[2] - newW,
        (p11.x + p21.x) *
          0.5 *
          (visibleRangeSnapshot[2] - visibleRangeSnapshot[0]) -
          (p12.x + p22.x) * 0.5 * newW +
          visibleRangeSnapshot[0]
      );
      const newY0 = clip(
        prop.dataRange[1],
        prop.dataRange[3] - newH,
        (p11.y + p21.y) *
          0.5 *
          (visibleRangeSnapshot[3] - visibleRangeSnapshot[1]) -
          (p12.y + p22.y) * 0.5 * newH +
          visibleRangeSnapshot[1]
      );

      const newVisibleRange: [number, number, number, number] = [
        newX0,
        newY0,
        newX0 + newW,
        newY0 + newH,
      ];
      setVisibleRange(newVisibleRange);
    }
  }, [pointerAnchors, currentPointers]);

  const [xAxisLabelElements, xGridLines] = React.useMemo<
    [JSX.Element[], JSX.Element[]]
  >(() => {
    if (!canvasSize) return [[], []];

    const elems: JSX.Element[] = [];
    const labels = (prop.xAxisLabels || defaultLabelGenerator)([
      visibleRange[0],
      visibleRange[2],
    ]);
    labels.forEach((lblInfo, idx) => {
      const angle = lblInfo.rotation || 0;
      const yBase = canvasSize[1] * prop.chartRegion[3];
      const xBase = canvasSize[0] * prop.chartRegion[0];
      const xDiff =
        ((canvasSize[0] * (prop.chartRegion[2] - prop.chartRegion[0])) /
          (visibleRange[2] - visibleRange[0])) *
        (lblInfo.value - visibleRange[0]);
      let transforms: string[] = [];

      if (angle > 45 && angle < 135) {
        transforms = [
          `translateX(-50%)`,
          `rotate(${angle}deg)`,
          `translateX(50%)`,
        ]
      } else {
        transforms = [
          `translateX(-50%)`,
          `rotate(${angle}deg)`,
        ]
      }
      elems.push(
        <HTMLPlacer
          key={`xaxis-${idx}`}
          x={xBase + xDiff}
          y={yBase}
          transforms={transforms}>
          {lblInfo.label}
        </HTMLPlacer>
      );
    });

    const lines: JSX.Element[] = [];
    labels.forEach((lblInfo, idx) => {
      const x =
        canvasSize[0] *
        (prop.chartRegion[2] - prop.chartRegion[0]) *
        ((lblInfo.value - visibleRange[0]) /
          (visibleRange[2] - visibleRange[0]));
      const yLen = canvasSize[1] * (prop.chartRegion[3] - prop.chartRegion[1]);
      lines.push(
        <path
          d={`M ${x} ${0} V ${yLen}`}
          stroke={prop.gridColor || '#CCCCCC'}
          strokeWidth={prop.gridWidth || 1}
          key={`xgrid-${idx}`}
        />
      );
    });

    return [elems, lines];
  }, [canvasSize, visibleRange, prop.xAxisLabels]);

  const [yAxisLabelElements, yGridLines] = React.useMemo<
    [JSX.Element[], JSX.Element[]]
  >(() => {
    if (!canvasSize) return [[], []];

    const elems: JSX.Element[] = [];
    const labels = (prop.yAxisLabels || defaultLabelGenerator)([
      visibleRange[1],
      visibleRange[3],
    ]);

    labels.forEach((lblInfo, idx) => {
      const angle = lblInfo.rotation || 0;
      const yBase = canvasSize[1] * prop.chartRegion[3];
      const xBase = canvasSize[0] * prop.chartRegion[0];
      const yDiff =
        -canvasSize[1] *
        (prop.chartRegion[3] - prop.chartRegion[1]) *
        ((lblInfo.value - visibleRange[1]) /
          (visibleRange[3] - visibleRange[1]));

      const transforms = [
        `translateX(-60%)`,
        `translateY(-50%)`,
        `rotate(${angle}deg)`,
      ]

      elems.push(
        <HTMLPlacer
          key={`yaxis-${idx}`}
          x={xBase - 5}
          y={yBase + yDiff}
          transforms={transforms}>
          {lblInfo.label}
        </HTMLPlacer>
      );
    });

    const lines: JSX.Element[] = [];
    labels.forEach((lblInfo, idx) => {
      const y =
        canvasSize[1] *
        (prop.chartRegion[3] - prop.chartRegion[1]) *
        (1.0 -
          (lblInfo.value - visibleRange[1]) /
            (visibleRange[3] - visibleRange[1]));
      const xLen = canvasSize[0] * (prop.chartRegion[2] - prop.chartRegion[0]);
      lines.push(
        <path
          d={`M ${0} ${y} H ${xLen}`}
          stroke={prop.gridColor || '#CCCCCC'}
          strokeWidth={prop.gridWidth || 1}
          key={`ygrid-${idx}`}
        />
      );
    });

    return [elems, lines];
  }, [canvasSize, visibleRange, prop.yAxisLabels]);

  const handleDoubleClick = () => {
    setVisibleRange(
      prop.defaultVisibleRange ? prop.defaultVisibleRange : prop.dataRange
    );
  };

  return (
    <div
      ref={setFrameRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        fontSize: '11px',
        margin: 0,
        padding: 0,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
    >
      <svg
        style={{
          position: 'absolute',
          left: `${prop.chartRegion[0] * 100}%`,
          top: `${prop.chartRegion[1] * 100}%`,
          width: `${(prop.chartRegion[2] - prop.chartRegion[0]) * 100}%`,
          height: `${(prop.chartRegion[3] - prop.chartRegion[1]) * 100}%`,
        }}
      >
        {xGridLines}
        {yGridLines}
      </svg>
      <Canvas
        dpr={1}
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        orthographic
        // to prevent our precious objects from being frustum-culled out
        camera={{
          left: prop.dataRange[0],
          bottom: prop.dataRange[1],
          right: prop.dataRange[2],
          top: prop.dataRange[3],
        }}
      >
        <ChartViewContext.Provider
          value={{
            visibleRange,
            chartRegion: prop.chartRegion,
          }}
        >
          {prop.children}
        </ChartViewContext.Provider>
      </Canvas>
      {xAxisLabelElements}
      {yAxisLabelElements}
    </div>
  );
};

export default ChartCanvas;
