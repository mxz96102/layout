import { promisedFuncAnimationFrame } from '../util/promise';
import { OutNode, Edge, PointTuple, IndexMap, Point, Node } from './types';
import { isNumber, isFunction, isArray, getDegree, isObject, getEdgeTerminal } from '../util';
import { AsyncLayout, LayoutOption } from './Layout';

type INode = OutNode & {
  size: number | PointTuple;
};

type NodeMap = {
  [key: string]: Node;
};

const proccessToFunc = (value: number | (() => number) | undefined, defaultV?: number): ((d: any) => number) => {
  let func;
  if (!value) {
    func = (d: any): number => {
      return defaultV || 1;
    };
  } else if (isNumber(value)) {
    func = (d: any): number => {
      return value;
    };
  } else {
    func = value;
  }
  return func as any;
};

export type GForceLayoutOptions = {
  type?: 'gForce';
  center?: PointTuple;
  width?: number;
  height?: number;
  linkDistance?: number | ((edge?: any, source?: any, target?: any) => number) | undefined;
  nodeStrength?: number | ((d?: any) => number) | undefined;
  edgeStrength?: number | ((d?: any) => number) | undefined;
  preventOverlap?: boolean;
  nodeSize?: number | number[] | ((d?: any) => number) | undefined;
  nodeSpacing?: number | number[] | ((d?: any) => number) | undefined;
  minMovement?: number;
  maxIteration?: number;
  damping?: number;
  maxSpeed?: number;
  coulombDisScale?: number;
  getMass?: ((d?: any) => number) | undefined;
  getCenter?: ((d?: any, degree?: number) => number[]) | undefined;
  gravity?: number;
  factor?: number;
  tick?: () => void;
  animate?: boolean;
  onLayoutEnd?: () => void;
  workerEnabled?: boolean;
  gpuEnabled?: boolean;
  interval?: number;
  collideStrength?: number;
  neverEnding?: boolean;
} & LayoutOption;

/**
 * graphin 中的 force 布局
 */
export default class GForceLayout extends AsyncLayout {
  option: GForceLayoutOptions = {
    maxIteration: 500,
    edgeStrength: 200,
    nodeStrength: 1000,
    coulombDisScale: 0.005,

    damping: 0.9,

    maxSpeed: 1000,

    minMovement: 0.5,

    interval: 0.02,

    factor: 1,

    /** 理想边长 */
    linkDistance: 1,

    /** 重力大小 */
    gravity: 10,

    preventOverlap: true,

    collideStrength: 1,
  };

  public nodes: INode[] | null = [];

  public edges: Edge[] | null = [];

  public nodeMap: NodeMap = {};

  public nodeIdxMap: IndexMap = {};

  center: PointTuple;

  /** 存储节点度数 */
  private degrees: number[];

  stopSign = false;

  linkDistance: (d: any) => number;
  nodeStrength: (d: any) => number;
  edgeStrength: (d: any) => number;
  nodeSizeFunc: (d: any) => number;

  constructor(options?: GForceLayoutOptions) {
    super();
    this.updateCfg(options);
  }

  public getDefaultCfg() {
    return {
      maxIteration: 500,
      gravity: 10,
      enableTick: true,
      animate: true,
    };
  }

  /**
   * 执行布局
   */
  public async execute() {
    const { nodes, edges } = this.data;

    if (!nodes || nodes.length === 0) {
      return;
    }

    const { center: optionCenter, width, height, nodeSize, preventOverlap, nodeSpacing } = this.option;
    const { linkDistance, nodeStrength, edgeStrength } = this.option;

    const center = optionCenter || [width / 2, height / 2];
    this.center = center;

    if (nodes.length === 1) {
      nodes[0].x = center[0];
      nodes[0].y = center[1];
      return;
    }
    const nodeMap: NodeMap = {};
    const nodeIdxMap: IndexMap = {};

    // pre layout nodes with random location
    nodes.forEach((node, i) => {
      if (!isNumber(node.x)) node.x = Math.random() * width;
      if (!isNumber(node.y)) node.y = Math.random() * height;
      nodeMap[node.id] = node;
      nodeIdxMap[node.id] = i;
    });

    this.nodeMap = nodeMap;
    this.nodeIdxMap = nodeIdxMap;

    this.linkDistance = proccessToFunc(linkDistance, 1);
    this.nodeStrength = proccessToFunc(nodeStrength, 1);
    this.edgeStrength = proccessToFunc(edgeStrength, 1);

    let nodeSizeFunc;
    if (preventOverlap) {
      let nodeSpacingFunc: (d?: any) => number;
      if (isNumber(nodeSpacing)) {
        nodeSpacingFunc = () => nodeSpacing as number;
      } else if (isFunction(nodeSpacing)) {
        nodeSpacingFunc = nodeSpacing as (d?: any) => number;
      } else {
        nodeSpacingFunc = () => 0;
      }
      if (!nodeSize) {
        nodeSizeFunc = (d: INode) => {
          if (d.size) {
            if (isArray(d.size)) {
              return Math.max(d.size[0], d.size[1]) + nodeSpacingFunc(d);
            }
            if (isObject(d.size)) {
              return Math.max(d.size.width, d.size.height) + nodeSpacingFunc(d);
            }
            return (d.size as number) + nodeSpacingFunc(d);
          }
          return 10 + nodeSpacingFunc(d);
        };
      } else if (isArray(nodeSize)) {
        nodeSizeFunc = (d: INode) => {
          return Math.max(nodeSize[0], nodeSize[1]) + nodeSpacingFunc(d);
        };
      } else {
        nodeSizeFunc = (d: INode) => (nodeSize as number) + nodeSpacingFunc(d);
      }
    }
    this.nodeSizeFunc = nodeSizeFunc;

    this.degrees = getDegree(nodes.length, nodeIdxMap, edges);
    if (!this.option.getMass) {
      this.option.getMass = (d) => {
        const mass = d.mass || this.degrees[this.nodeIdxMap[d.id]] || 1;
        return mass;
      };
    }

    // layout
    await this.run();
    return this.data;
  }

  public async run() {
    const { nodes } = this.data;
    const { maxIteration, workerEnabled, minMovement, animate, neverEnding } = this.option;

    if (!nodes) return;

    if (workerEnabled || !animate) {
      this.stopSign = true;
      for (let i = 0; i < maxIteration; i++) {
        const previousPos = this.runOneStep(i);
        if (this.reachMoveThreshold(nodes, previousPos, minMovement)) {
          return;
        }
      }
    } else {
      let iter = 0;
      await this.stop();
      await promisedFuncAnimationFrame(() => {
        if (this.stopSign) {
          return true;
        }
        const previousPos = this.runOneStep(iter);

        if (!neverEnding && this.reachMoveThreshold(nodes, previousPos, minMovement)) {
          return true;
        }
        iter++;
        return false;
      });
    }
  }

  private reachMoveThreshold(nodes: any, previousPos: any, minMovement: number) {
    // whether to stop the iteration
    let movement = 0;
    nodes.forEach((node: any, j: number) => {
      const vx = node.x - previousPos[j].x;
      const vy = node.y - previousPos[j].y;
      movement += Math.sqrt(vx * vx + vy * vy);
    });
    movement /= nodes.length;
    return movement < minMovement;
  }

  private runOneStep(iter: number) {
    const { nodes, edges } = this.data;
    const { interval, tick } = this.option;
    const accArray: number[] = [];
    const velArray: number[] = [];
    if (!nodes) return;
    nodes.forEach((_, i) => {
      accArray[2 * i] = 0;
      accArray[2 * i + 1] = 0;
      velArray[2 * i] = 0;
      velArray[2 * i + 1] = 0;
    });
    this.calRepulsive(accArray, nodes);
    if (edges) this.calAttractive(accArray, edges);
    this.calGravity(accArray, nodes);
    const stepInterval = Math.max(0.02, interval - iter * 0.002);
    this.updateVelocity(accArray, velArray, stepInterval, nodes);
    const previousPos: Point[] = [];
    nodes.forEach((node) => {
      previousPos.push({
        x: node.x,
        y: node.y,
      });
    });
    this.updatePosition(velArray, stepInterval, nodes);
    if (tick) {
      tick();
    }
    return previousPos;
  }

  public calRepulsive(accArray: number[], nodes: Node[]) {
    const { getMass, factor, coulombDisScale, preventOverlap, collideStrength = 1 } = this.option;
    const { nodeStrength, nodeSizeFunc: nodeSize } = this;
    nodes.forEach((ni: INode, i) => {
      const massi = getMass ? getMass(ni) : 1;
      nodes.forEach((nj, j) => {
        if (i >= j) return;
        // if (!accArray[j]) accArray[j] = 0;
        let vecX = ni.x - nj.x;
        let vecY = ni.y - nj.y;
        if (vecX === 0 && vecY === 0) {
          vecX = Math.random() * 0.01;
          vecY = Math.random() * 0.01;
        }
        const lengthSqr = vecX * vecX + vecY * vecY;
        const vecLength = Math.sqrt(lengthSqr);
        const nVecLength = (vecLength + 0.1) * coulombDisScale;
        const direX = vecX / vecLength;
        const direY = vecY / vecLength;
        const param = ((nodeStrength(ni) + nodeStrength(nj)) * 0.5 * factor) / (nVecLength * nVecLength);
        const massj = getMass ? getMass(nj) : 1;
        accArray[2 * i] += direX * param;
        accArray[2 * i + 1] += direY * param;
        accArray[2 * j] -= direX * param;
        accArray[2 * j + 1] -= direY * param;
        if (preventOverlap && (nodeSize(ni) + nodeSize(nj)) / 2 > vecLength) {
          const paramOverlap = (collideStrength * (nodeStrength(ni) + nodeStrength(nj)) * 0.5) / lengthSqr;
          accArray[2 * i] += (direX * paramOverlap) / massi;
          accArray[2 * i + 1] += (direY * paramOverlap) / massi;
          accArray[2 * j] -= (direX * paramOverlap) / massj;
          accArray[2 * j + 1] -= (direY * paramOverlap) / massj;
        }
      });
    });
  }

  public calAttractive(accArray: number[], edges: Edge[]) {
    const { nodeMap, nodeIdxMap, linkDistance, edgeStrength } = this;
    const nodeSize = this.nodeSizeFunc;
    const getMass = this.option.getMass;
    edges.forEach((edge, i) => {
      const source = getEdgeTerminal(edge, 'source');
      const target = getEdgeTerminal(edge, 'target');
      const sourceNode = nodeMap[source];
      const targetNode = nodeMap[target];
      let vecX = targetNode.x - sourceNode.x;
      let vecY = targetNode.y - sourceNode.y;
      if (vecX === 0 && vecY === 0) {
        vecX = Math.random() * 0.01;
        vecY = Math.random() * 0.01;
      }
      const vecLength = Math.sqrt(vecX * vecX + vecY * vecY);
      const direX = vecX / vecLength;
      const direY = vecY / vecLength;
      const length = linkDistance(edge) || 1 + (nodeSize(sourceNode) + nodeSize(sourceNode) || 0) / 2;
      const diff = length - vecLength;
      const param = diff * edgeStrength(edge);
      const sourceIdx = nodeIdxMap[source];
      const targetIdx = nodeIdxMap[target];
      const massSource = getMass ? getMass(sourceNode) : 1;
      const massTarget = getMass ? getMass(targetNode) : 1;
      accArray[2 * sourceIdx] -= (direX * param) / massSource;
      accArray[2 * sourceIdx + 1] -= (direY * param) / massSource;
      accArray[2 * targetIdx] += (direX * param) / massTarget;
      accArray[2 * targetIdx + 1] += (direY * param) / massTarget;
    });
  }

  public calGravity(accArray: number[], nodes: Node[]) {
    const center = this.center;
    const defaultGravity = this.option.gravity;
    const degrees = this.degrees;
    const nodeLength = nodes.length;
    for (let i = 0; i < nodeLength; i++) {
      const node = nodes[i];
      let vecX = node.x - center[0];
      let vecY = node.y - center[1];
      let gravity = defaultGravity;

      if (this.option.getCenter) {
        const customCenterOpt = this.option.getCenter(node, degrees[i]);
        if (
          customCenterOpt &&
          isNumber(customCenterOpt[0]) &&
          isNumber(customCenterOpt[1]) &&
          isNumber(customCenterOpt[2])
        ) {
          vecX = node.x - customCenterOpt[0];
          vecY = node.y - customCenterOpt[1];
          gravity = customCenterOpt[2];
        }
      }
      if (!gravity) continue;

      accArray[2 * i] -= gravity * vecX;
      accArray[2 * i + 1] -= gravity * vecY;
    }
  }

  public updateVelocity(accArray: number[], velArray: number[], stepInterval: number, nodes: Node[]) {
    const { damping, maxSpeed } = this.option;
    const param = stepInterval * damping;
    // const nodes = self.nodes;

    for (let i = 0; i < nodes.length; i++) {
      let vx = accArray[2 * i] * param || 0.01;
      let vy = accArray[2 * i + 1] * param || 0.01;
      const vLength = Math.sqrt(vx * vx + vy * vy);
      if (vLength > maxSpeed) {
        const param2 = maxSpeed / vLength;
        vx = param2 * vx;
        vy = param2 * vy;
      }
      velArray[2 * i] = vx;
      velArray[2 * i + 1] = vy;
    }
  }

  public updatePosition(velArray: number[], stepInterval: number, nodes: Node[]) {
    nodes.forEach((node: any, i) => {
      if (isNumber(node.fx) && isNumber(node.fy)) {
        node.x = node.fx;
        node.y = node.fy;
        return;
      }
      const distX = velArray[2 * i] * stepInterval;
      const distY = velArray[2 * i + 1] * stepInterval;
      node.x += distX;
      node.y += distY;
    });
  }

  public stop() {
    this.stopSign = true;
    return new Promise<void>((res) => {
      setTimeout(() => {
        this.stopSign = false;
        res();
      }, 10);
    });
  }
}
