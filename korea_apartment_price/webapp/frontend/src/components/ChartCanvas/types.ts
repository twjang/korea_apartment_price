
export type DrawingProp = {
  fillColor?: string;
  linecolor?: string;
  lineWidth?: number;
};

export type MarkerType = 'o' | 'box' | "heart" | "dialog_balloon" | "diamond" | 
  "triangle" | "divide" | "+" | "-" | "cylinder" | "arrow_up" | "trapezoid" | 
  "donut" | "arrow_left_up" | "x" | "right_triangle" | "star" | "arrow_u_turn" | 
  "hexagon" | "pentagon" | "page" | "plaque";

export type PointStyleProp = DrawingProp & {
  readonly size: number,
  readonly shape: MarkerType, 
  readonly path?: string,
};

export type LineStyleProp = DrawingProp & {
  dashType?: number[] 
}
