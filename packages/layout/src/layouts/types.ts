export interface Node {
  id: string;
  x?: number;
  y?: number;
  layout?: boolean;
  comboId?: string;
  layer?: number;
  cluster?: string;
}

export interface OutNode extends Node {
  x: number;
  y: number;
  comboId?: string;
  layer?: number; // dagre布局中指定的层级
  _order?: number; // dagre布局中层内排序结果，用于增量布局
  layout?: boolean;
  size?: number | number[] | undefined;
}

export interface Edge {
  source: string;
  target: string;
  [key: string]: any;
}

export interface Combo {
  id: string;
  parentId?: string;
  x?: number;
  y?: number;
  name?: string | number;
  cx?: number;
  cy?: number;
  count?: number;
  depth?: number;
  children?: any[];
  empty?: boolean;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  size?: number;
  r?: number;
  itemType?: string;
}

export interface Model {
  nodes?: Node[];
  edges?: Edge[];
  combos?: Combo[];
  comboEdges?: Edge[];
  hiddenNodes?: Node[];
  hiddenEdges?: Edge[];
  hiddenCombos?: Combo[];
}

export interface OutModel extends Model {
  nodes?: OutNode[];
}

export type PointTuple = [number, number];

export interface Size {
  width: number;
  height: number;
}

export type IndexMap = {
  [key: string]: number;
};

export type Matrix = number[];

export type Point = {
  x: number;
  y: number;
};

export interface ComboTree {
  id: string;
  children?: ComboTree[];
  depth?: number;
  parentId?: string;
  itemType?: 'node' | 'combo';
  [key: string]: unknown;
}
export interface ComboConfig {
  id: string;
  parentId?: string;
  children?: ComboTree[];
  depth?: number;
}

type INode = OutNode & {
  degree: number;
  size: number | PointTuple;
};

export type PossibleNodeSize = number | [number, number] | { width: number; height: number };

export type NodeSize = PossibleNodeSize | ((node: Node) => PossibleNodeSize);

export type NodeSpace = number | ((node: Node) => number);
