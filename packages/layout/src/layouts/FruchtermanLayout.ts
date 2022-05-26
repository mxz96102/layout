import { promisedFuncAnimationFrame } from '../util/promise';
import { Node, Edge, PointTuple, IndexMap, Point, NodeSize } from './types';
import { isNumber } from '../util';
import { AsyncLayout, LayoutOption } from './Layout';

type NodeMap = {
  [key: string]: INode;
};

type INode = Node & {
  cluster?: string;
};

const SPEED_DIVISOR = 800;

export type FruchtermanLayoutOptions = {
  center?: PointTuple;
  maxIteration?: number;
  width?: number;
  height?: number;
  gravity?: number;
  speed?: number;
  clustering?: boolean;
  clusterGravity?: number;
  animate?: boolean;
  workerEnabled?: boolean;
  nodeSize?: NodeSize;
  tick?: () => void;
} & LayoutOption;

/**
 * fruchterman 布局
 */
export default class FruchtermanLayout extends AsyncLayout {
  option: FruchtermanLayoutOptions = {
    maxIteration: 1000,
    gravity: 10,
    speed: 5,
    clustering: false,
    clusterGravity: 10,
    width: 300,
    height: 300,
    nodeSize: 10,
  };

  public nodeMap: NodeMap = {};

  public nodeIdxMap: IndexMap = {};

  constructor(options?: FruchtermanLayoutOptions) {
    super();
    this.updateCfg(options);
  }

  private stopSign = false;

  /**
   * 执行布局
   */
  public async execute() {
    const { nodes } = this.data;

    if (!nodes || nodes.length === 0) {
      return;
    }

    const { width, height, center: optionCenter } = this.option;

    const center = optionCenter || [width / 2, height / 2];
    this.option.center = center;

    if (nodes.length === 1) {
      nodes[0].x = center[0];
      nodes[0].y = center[1];
      return;
    }
    const nodeMap: NodeMap = {};
    const nodeIdxMap: IndexMap = {};
    nodes.forEach((node, i) => {
      if (!isNumber(node.x)) node.x = Math.random() * width;
      if (!isNumber(node.y)) node.y = Math.random() * height;
      nodeMap[node.id] = node;
      nodeIdxMap[node.id] = i;
    });
    this.nodeMap = nodeMap;
    this.nodeIdxMap = nodeIdxMap;
    // layout
    await this.run();
    return this.data;
  }

  public async run() {
    const { nodes, edges } = this.data;
    if (!nodes) return;
    const { maxIteration, workerEnabled, animate } = this.option;
    if (workerEnabled || !animate) {
      this.stopSign = true;
      for (let i = 0; i < maxIteration; i++) {
        this.runOneStep();
      }
    } else {
      let iter = 0;
      // interval for render the result after each iteration
      await this.stop();
      await promisedFuncAnimationFrame(() => {
        if (this.stopSign || iter >= maxIteration) {
          return true;
        }
        this.runOneStep();
        iter++;
        return false;
      });
    }
    return {
      nodes,
      edges,
    };
  }

  private runOneStep() {
    const { nodes, edges } = this.data;
    if (!nodes) return;
    const {
      center,
      gravity,
      speed,
      clustering,
      height,
      width,
      tick,
      clusterGravity: optionClusterGravity,
    } = this.option;
    const clusterGravity = optionClusterGravity || gravity;
    const clusterMap = {};
    const area = height * width;
    const maxDisplace = Math.sqrt(area) / 10;
    const maxMovement = maxDisplace * (speed / SPEED_DIVISOR);
    const k2 = area / (nodes.length + 1);
    const k = Math.sqrt(k2);
    const displacements: Point[] = [];
    this.applyCalculate(nodes, edges, displacements, k, k2);

    // gravity for clusters
    if (clustering) {
      // re-compute the clustering centers
      nodes.forEach((n) => {
        if (!clusterMap[n.cluster]) {
          clusterMap[n.cluster] = {
            name: n.cluster,
            cx: 0,
            cy: 0,
            count: 0,
          };
        }
        const c = clusterMap[n.cluster];
        if (isNumber(n.x)) {
          c.cx += n.x;
        }
        if (isNumber(n.y)) {
          c.cy += n.y;
        }
        c.count++;
      });

      for (const key in clusterMap) {
        clusterMap[key].cx /= clusterMap[key].count;
        clusterMap[key].cy /= clusterMap[key].count;
      }
    }

    // gravity
    nodes.forEach((n, j) => {
      if (!isNumber(n.x) || !isNumber(n.y)) return;
      let disX = displacements[j].x;
      let disY = displacements[j].y;

      if (clustering) {
        const c = clusterMap[n.cluster];
        const dCx = n.x - c.cx;
        const dCy = n.y - c.cy;
        const clusterDist = Math.sqrt(dCx * dCx + dCy * dCy);
        const clusterGravityForce = k * clusterGravity;
        disX -= (clusterGravityForce * dCx) / clusterDist;
        disY -= (clusterGravityForce * dCy) / clusterDist;
      }

      const gravityForce = 0.01 * k * gravity;
      disX -= gravityForce * (n.x - center[0]);
      disY -= gravityForce * (n.y - center[1]);
      const distLength = Math.sqrt(disX * disX + disY * disY);
      if (distLength > 0) {
        const limitedDist = Math.min(maxMovement, distLength);
        n.x += (disX / distLength) * limitedDist;
        n.y += (disY / distLength) * limitedDist;
      }
    });

    if (tick) {
      tick();
    }
  }

  private applyCalculate(nodes: INode[], edges: Edge[] | null, displacements: Point[], k: number, k2: number) {
    this.calRepulsive(nodes, displacements, k2);
    if (edges) this.calAttractive(edges, displacements, k);
  }

  private calRepulsive(nodes: INode[], displacements: Point[], k2: number) {
    for (let i = 0; i < nodes.length; i += 1) {
      const n1 = nodes[i];

      if (!isNumber(n1.x) || !isNumber(n1.y)) continue;
      if (!displacements[i]) {
        displacements[i] = { x: 0, y: 0 };
      }
      for (let j = i + 1; j < nodes.length; j += 1) {
        const n2 = nodes[j];
        if (!isNumber(n2.x) || !isNumber(n2.y)) continue;
        if (!displacements[j]) {
          displacements[j] = { x: 0, y: 0 };
        }
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const d2 = dx * dx + dy * dy;
        if (d2 === 0) continue;
        const d = Math.sqrt(d2);
        const repulsiveF = k2 / d2;
        const repulsiveForce = (repulsiveF * (d - 1)) / d;
        displacements[i].x += dx * repulsiveForce;
        displacements[i].y += dy * repulsiveForce;
        displacements[j].x -= dx * repulsiveForce;
        displacements[j].y -= dy * repulsiveForce;
      }
    }
  }

  private calAttractive(edges: Edge[], displacements: Point[], k: number) {
    edges.forEach((e) => {
      const source = e.source;
      const target = e.target;
      if (!source || !target) return;
      const uIndex = this.nodeIdxMap[source];
      const vIndex = this.nodeIdxMap[target];
      if (uIndex === vIndex) {
        return;
      }
      const u = this.nodeMap[source];
      const v = this.nodeMap[target];
      if (!isNumber(v.x) || !isNumber(u.x) || !isNumber(v.y) || !isNumber(u.y)) {
        return;
      }
      const vecX = v.x - u.x;
      const vecY = v.y - u.y;
      const vecLength = Math.sqrt(vecX * vecX + vecY * vecY);
      const common = (vecLength * vecLength) / k;
      displacements[vIndex].x -= (vecX / vecLength) * common;
      displacements[vIndex].y -= (vecY / vecLength) * common;
      displacements[uIndex].x += (vecX / vecLength) * common;
      displacements[uIndex].y += (vecY / vecLength) * common;
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
