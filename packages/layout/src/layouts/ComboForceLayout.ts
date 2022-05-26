import { isArray, isNumber, isFunction, traverseTreeUp, isObject, getEdgeTerminal } from '../util';
import { Edge, OutNode, PointTuple, IndexMap, Combo, ComboTree, Point } from './types';
import { Layout, LayoutOption } from './Layout';

type Node = OutNode & {
  depth: number;
  itemType?: string;
  comboId?: string;
};

type NodeMap = {
  [key: string]: Node;
};

type ComboMap = {
  [key: string]: Combo;
};

export type ComboForceLayoutOptions = {
  width?: number;
  height?: number;
  center?: PointTuple;
  maxIteration?: number;
  linkDistance?: number | ((d?: unknown) => number);
  nodeStrength?: number | ((d?: unknown) => number);
  edgeStrength?: number | ((d?: unknown) => number);
  preventOverlap?: boolean;
  preventNodeOverlap?: boolean;
  preventComboOverlap?: boolean;
  collideStrength?: number | undefined;
  nodeCollideStrength?: number | undefined;
  comboCollideStrength?: number | undefined;
  nodeSize?: number | number[] | ((d?: unknown) => number) | undefined;
  nodeSpacing?: ((d?: unknown) => number) | number | undefined;
  comboSpacing?: ((d?: unknown) => number) | number | undefined;
  comboPadding?: ((d?: unknown) => number) | number | number[] | undefined;
  alpha?: number;
  alphaDecay?: number;
  alphaMin?: number;
  onTick?: () => void;
  gravity?: number;
  comboGravity?: number;
  optimizeRangeFactor?: number;
  depthAttractiveForceScale?: number;
  depthRepulsiveForceScale?: number;
  velocityDecay?: number;
  workerEnabled?: boolean;
} & LayoutOption;

/**
 * force layout for graph with combos
 */
export default class ComboForceLayout extends Layout {
  option: ComboForceLayoutOptions = {
    center: [0, 0],
    maxIteration: 100,
    gravity: 10,
    comboGravity: 10,
    linkDistance: 10,
    alpha: 1,
    alphaMin: 0.001,
    alphaDecay: 1 - Math.pow(0.001, 1 / 300),
    velocityDecay: 0.6,
    edgeStrength: 0.6,
    nodeStrength: 30,
    preventOverlap: false,
    preventComboOverlap: true,
    preventNodeOverlap: true,
    nodeCollideStrength: 0.5,
    comboCollideStrength: 0.5,
    comboSpacing: 20,
    comboPadding: 10,
    optimizeRangeFactor: 1,
    depthAttractiveForceScale: 1,
    depthRepulsiveForceScale: 2,
    width: 300,
    height: 300,
  };

  public alphaTarget = 0;

  /** 内部计算参数 */
  public nodes: Node[] = [];

  public edges: Edge[] = [];

  public combos: Combo[] = [];

  private comboTrees: ComboTree[] = [];

  // add a virtual root to comboTrees
  private comboTree: ComboTree;

  private bias: number[] = [];

  private nodeMap: NodeMap = {};

  private oriComboMap: ComboMap = {};

  private indexMap: IndexMap = {};

  private comboMap: ComboMap = {};

  private previousLayouted = false;

  constructor(options?: ComboForceLayoutOptions) {
    super();
    this.updateCfg(options);
  }

  public getDefaultCfg() {
    return {
      maxIteration: 100,
      center: [0, 0],
      gravity: 10,
      speed: 1,
      comboGravity: 30,
      preventOverlap: false,
      preventComboOverlap: true,
      preventNodeOverlap: true,
      nodeSpacing: undefined,
      collideStrength: undefined,
      nodeCollideStrength: 0.5,
      comboCollideStrength: 0.5,
      comboSpacing: 20,
      comboPadding: 10,
      edgeStrength: 0.6,
      nodeStrength: 30,
      linkDistance: 10,
    };
  }

  /**
   * 执行布局
   */
  public execute() {
    const { nodes } = this.data;
    const { center } = this.option;
    this.comboTree = {
      id: 'comboTreeRoot',
      depth: -1,
      children: this.comboTrees,
    };

    if (!nodes || nodes.length === 0) {
      return;
    }
    if (nodes.length === 1) {
      nodes[0].x = center[0];
      nodes[0].y = center[1];
      return;
    }

    this.initVals();

    // layout
    this.run();
    return this.data;
  }

  public run() {
    const { nodes, combos } = this.data;
    const { maxIteration: optMaxIteration, center, alpha, alphaDecay, velocityDecay, onTick } = this.option;
    const maxIteration = this.previousLayouted ? optMaxIteration / 5 : optMaxIteration;

    // init the positions to make the nodes with same combo gather around the combo
    const comboMap = this.comboMap;
    if (!this.previousLayouted) this.initPos(comboMap);

    // iterate
    for (let i = 0; i < maxIteration; i++) {
      const displacements: Point[] = [];
      nodes.forEach((_, j) => {
        displacements[j] = { x: 0, y: 0 };
      });
      this.applyCalculate(displacements);

      // gravity for combos
      this.applyComboCenterForce(displacements);

      // move
      nodes.forEach((n, j) => {
        if (!isNumber(n.x) || !isNumber(n.y)) return;
        n.x += displacements[j].x * velocityDecay;
        n.y += displacements[j].y * velocityDecay;
      });
      this.option.alpha += (this.alphaTarget - alpha) * alphaDecay;
      if (onTick) {
        onTick();
      }
    }

    // move to center
    const meanCenter = [0, 0];
    nodes.forEach((n) => {
      if (!isNumber(n.x) || !isNumber(n.y)) return;
      meanCenter[0] += n.x;
      meanCenter[1] += n.y;
    });
    meanCenter[0] /= nodes.length;
    meanCenter[1] /= nodes.length;
    const centerOffset = [center[0] - meanCenter[0], center[1] - meanCenter[1]];
    nodes.forEach((n) => {
      if (!isNumber(n.x) || !isNumber(n.y)) return;
      n.x += centerOffset[0];
      n.y += centerOffset[1];
    });

    // arrange the empty combo
    combos.forEach((combo) => {
      const mapped = comboMap[combo.id];
      if (mapped && mapped.empty) {
        combo.x = mapped.cx || combo.x;
        combo.y = mapped.cy || combo.y;
      }
    });

    this.previousLayouted = true;
  }

  private initVals() {
    const count: any = {};
    const { nodes, combos, edges } = this.data;

    const nodeMap: NodeMap = {};
    const indexMap: IndexMap = {};
    nodes.forEach((node, i) => {
      nodeMap[node.id] = node as Node;
      indexMap[node.id] = i;
    });
    this.nodeMap = nodeMap;
    this.indexMap = indexMap;

    const oriComboMap: ComboMap = {};
    combos.forEach((combo) => {
      oriComboMap[combo.id] = combo;
    });
    this.oriComboMap = oriComboMap;
    this.comboMap = this.getComboMap();

    this.option.preventComboOverlap = this.option.preventComboOverlap || this.option.preventOverlap;
    this.option.preventNodeOverlap = this.option.preventNodeOverlap || this.option.preventOverlap;

    if (this.option.collideStrength) {
      this.option.comboCollideStrength = this.option.collideStrength;
      this.option.nodeCollideStrength = this.option.collideStrength;
    }
    this.option.comboCollideStrength = this.option.comboCollideStrength ? this.option.comboCollideStrength : 0;
    this.option.nodeCollideStrength = this.option.nodeCollideStrength ? this.option.nodeCollideStrength : 0;

    // get edge bias
    for (let i = 0; i < edges.length; ++i) {
      const source = getEdgeTerminal(edges[i], 'source');
      const target = getEdgeTerminal(edges[i], 'target');
      if (count[source]) count[source]++;
      else count[source] = 1;
      if (count[target]) count[target]++;
      else count[target] = 1;
    }
    const bias = [];
    for (let i = 0; i < edges.length; ++i) {
      const source = getEdgeTerminal(edges[i], 'source');
      const target = getEdgeTerminal(edges[i], 'target');
      bias[i] = count[source] / (count[source] + count[target]);
    }
    this.bias = bias;

    const nodeSize = this.option.nodeSize;
    const nodeSpacing = this.option.nodeSpacing;
    let nodeSizeFunc: (d: any) => number;
    let nodeSpacingFunc: (d: any) => number;

    // nodeSpacing to function
    if (isNumber(nodeSpacing)) {
      nodeSpacingFunc = () => nodeSpacing as any;
    } else if (isFunction(nodeSpacing)) {
      nodeSpacingFunc = nodeSpacing;
    } else {
      nodeSpacingFunc = () => 0;
    }
    this.option.nodeSpacing = nodeSpacingFunc;

    // nodeSize to function
    if (!nodeSize) {
      nodeSizeFunc = (d) => {
        if (d.size) {
          if (isArray(d.size)) {
            const res = d.size[0] > d.size[1] ? d.size[0] : d.size[1];
            return res / 2;
          }
          if (isObject(d.size)) {
            const res = d.size.width > d.size.height ? d.size.width : d.size.height;
            return res / 2;
          }
          return d.size / 2;
        }
        return 10;
      };
    } else if (isFunction(nodeSize)) {
      nodeSizeFunc = (d) => {
        return (nodeSize as (d) => number)(d);
      };
    } else if (isArray(nodeSize)) {
      const larger = nodeSize[0] > nodeSize[1] ? nodeSize[0] : nodeSize[1];
      const radius = larger / 2;
      nodeSizeFunc = () => radius;
    } else {
      // number type
      const radius = (nodeSize as number) / 2;
      nodeSizeFunc = () => radius;
    }
    this.option.nodeSize = nodeSizeFunc;

    // comboSpacing to function
    const comboSpacing = this.option.comboSpacing;
    let comboSpacingFunc: (d: any) => number;
    if (isNumber(comboSpacing)) {
      comboSpacingFunc = () => comboSpacing as any;
    } else if (isFunction(comboSpacing)) {
      comboSpacingFunc = comboSpacing;
    } else {
      // null type
      comboSpacingFunc = () => 0;
    }
    this.option.comboSpacing = comboSpacingFunc;

    // comboPadding to function
    const comboPadding = this.option.comboPadding;
    let comboPaddingFunc: (d: any) => number;
    if (isNumber(comboPadding)) {
      comboPaddingFunc = () => comboPadding as any;
    } else if (isArray(comboPadding)) {
      comboPaddingFunc = () => Math.max.apply(null, comboPadding);
    } else if (isFunction(comboPadding)) {
      comboPaddingFunc = comboPadding;
    } else {
      // null type
      comboPaddingFunc = () => 0;
    }
    this.option.comboPadding = comboPaddingFunc;

    // linkDistance to function
    let linkDistance = this.option.linkDistance;
    let linkDistanceFunc;
    if (!linkDistance) {
      linkDistance = 10;
    }
    if (isNumber(linkDistance)) {
      linkDistanceFunc = () => {
        return linkDistance;
      };
    } else {
      linkDistanceFunc = linkDistance;
    }
    this.option.linkDistance = linkDistanceFunc as (d?: unknown) => number;

    // linkStrength to function
    let edgeStrength = this.option.edgeStrength;
    let edgeStrengthFunc;
    if (!edgeStrength) {
      edgeStrength = 1;
    }
    if (isNumber(edgeStrength)) {
      edgeStrengthFunc = () => {
        return edgeStrength;
      };
    } else {
      edgeStrengthFunc = edgeStrength;
    }
    this.option.edgeStrength = edgeStrengthFunc as (d?: unknown) => number;

    // nodeStrength to function
    let nodeStrength = this.option.nodeStrength;
    let nodeStrengthFunc;
    if (!nodeStrength) {
      nodeStrength = 30;
    }
    if (isNumber(nodeStrength)) {
      nodeStrengthFunc = () => {
        return nodeStrength;
      };
    } else {
      nodeStrengthFunc = nodeStrength;
    }
    this.option.nodeStrength = nodeStrengthFunc as (d?: unknown) => number;
  }

  private initPos(comboMap: ComboMap) {
    const { nodes } = this.data;
    nodes.forEach((node, i) => {
      const comboId = (node as any).comboId;
      const combo: any = comboMap[comboId];
      if (comboId && combo) {
        node.x = combo.cx + 100 / (i + 1);
        node.y = combo.cy + 100 / (i + 1);
      } else {
        node.x = 100 / (i + 1);
        node.y = 100 / (i + 1);
      }
    });
  }

  private getComboMap() {
    const nodeMap = this.nodeMap;
    const comboTrees = this.comboTrees;
    const oriComboMap = this.oriComboMap;
    const comboMap: ComboMap = {};

    (comboTrees || []).forEach((ctree: any) => {
      const treeChildren: Combo[] | Node[] = [];
      traverseTreeUp<ComboTree>(ctree, (treeNode) => {
        if (treeNode.itemType === 'node') return true; // skip it
        if (!oriComboMap[treeNode.id]) return true; // means it is hidden, skip it
        if (comboMap[treeNode.id] === undefined) {
          const combo = {
            id: treeNode.id,
            name: treeNode.id,
            cx: 0,
            cy: 0,
            count: 0,
            depth: (this.oriComboMap[treeNode.id].depth as number) || 0,
            children: [] as any,
          };
          comboMap[treeNode.id] = combo;
        }
        const children = treeNode.children;
        if (children) {
          children.forEach((child: any) => {
            if (!comboMap[child.id] && !nodeMap[child.id]) return true; // means it is hidden
            treeChildren.push(child);
          });
        }
        const c: any = comboMap[treeNode.id];
        c.cx = 0;
        c.cy = 0;

        if (treeChildren.length === 0) {
          c.empty = true;
          const oriCombo = oriComboMap[treeNode.id];
          c.cx = oriCombo.x as number;
          c.cy = oriCombo.y as number;
        }

        treeChildren.forEach((child: Combo | Node) => {
          (c.count as number)++;
          if (child.itemType !== 'node') {
            const childCombo = comboMap[child.id];
            if (isNumber(childCombo.cx)) c.cx += childCombo.cx;
            if (isNumber(childCombo.cy)) c.cy += childCombo.cy;
            return;
          }
          const node = nodeMap[child.id];
          // means the node is hidden, skip it
          if (!node) return;

          if (isNumber(node.x)) {
            c.cx += node.x;
          }
          if (isNumber(node.y)) {
            c.cy += node.y;
          }
        });
        c.cx /= (c.count || 1) as number;
        c.cy /= (c.count || 1) as number;

        c.children = treeChildren as any;

        return true;
      });
    });

    return comboMap;
  }

  private applyComboCenterForce(displacements: Point[]) {
    const gravity = this.option.gravity;
    const comboGravity = this.option.comboGravity || gravity;
    const alpha = this.option.alpha;
    const comboTrees = this.comboTrees;
    const indexMap = this.indexMap;
    const nodeMap = this.nodeMap;
    const comboMap = this.comboMap;

    (comboTrees || []).forEach((ctree) => {
      traverseTreeUp<ComboTree>(ctree, (treeNode) => {
        if (treeNode.itemType === 'node') return true; // skip it
        const combo = comboMap[treeNode.id];
        // means the combo is hidden, skip it
        if (!combo) return true;
        const c: any = comboMap[treeNode.id];

        // higher depth the combo, larger the gravity
        const gravityScale = (((c.depth as number) + 1) / 10) * 0.5;
        // apply combo center force for all the descend nodes in this combo
        // and update the center position and count for this combo
        const comboX = c.cx;
        const comboY = c.cy;
        c.cx = 0;
        c.cy = 0;
        c.children.forEach((child: any) => {
          if (child.itemType !== 'node') {
            const childCombo = comboMap[child.id];
            if (childCombo && isNumber(childCombo.cx)) c.cx += childCombo.cx;
            if (childCombo && isNumber(childCombo.cy)) c.cy += childCombo.cy;
            return;
          }
          const node = nodeMap[child.id];
          const vecX = node.x - comboX || 0.005;
          const vecY = node.y - comboY || 0.005;
          const l = Math.sqrt(vecX * vecX + vecY * vecY);
          const childIdx = indexMap[node.id];
          const params = ((comboGravity * alpha) / l) * gravityScale;
          displacements[childIdx].x -= vecX * params;
          displacements[childIdx].y -= vecY * params;

          if (isNumber(node.x)) c.cx += node.x;
          if (isNumber(node.y)) c.cy += node.y;
        });
        c.cx /= (c.count || 1) as number;
        c.cy /= (c.count || 1) as number;
        return true;
      });
    });
  }

  private applyCalculate(displacements: Point[]) {
    const comboMap = this.comboMap;
    const { nodes } = this.data;
    // store the vx, vy, and distance to reduce dulplicate calculation
    const vecMap: any = {};
    nodes.forEach((v, i) => {
      nodes.forEach((u, j) => {
        if (i < j) return;
        const vx = v.x - u.x || 0.005;
        const vy = v.y - u.y || 0.005;
        let vl2 = vx * vx + vy * vy;
        const vl = Math.sqrt(vl2);
        if (vl2 < 1) vl2 = vl;
        vecMap[`${v.id}-${u.id}`] = { vx, vy, vl2, vl };
        vecMap[`${u.id}-${v.id}`] = { vl2, vl, vx: -vx, vy: -vy };
      });
    });
    // get the sizes of the combos
    this.updateComboSizes(comboMap);
    this.calRepulsive(displacements, vecMap);
    this.calAttractive(displacements, vecMap);

    const preventComboOverlap = this.option.preventComboOverlap;
    if (preventComboOverlap) this.comboNonOverlapping(displacements, comboMap);
  }

  /**
   * Update the sizes of the combos according to their children
   * Used for combos nonoverlap, but not re-render the combo shapes
   */
  private updateComboSizes(comboMap: ComboMap) {
    const comboTrees = this.comboTrees;
    const nodeMap = this.nodeMap;
    const nodeSize = this.option.nodeSize as (d?: unknown) => number;
    const comboSpacing = this.option.comboSpacing as (d?: unknown) => number;
    const comboPadding = this.option.comboPadding as (d?: unknown) => number;
    (comboTrees || []).forEach((ctree) => {
      const treeChildren: Combo[] | Node[] = [];
      traverseTreeUp<ComboTree>(ctree, (treeNode: ComboTree) => {
        if (treeNode.itemType === 'node') return true; // skip it
        const c = comboMap[treeNode.id];
        // means the combo is hidden, skip it
        if (!c) return false;
        const children = treeNode.children;
        if (children) {
          children.forEach((child: any) => {
            // means the combo is hidden.
            if (!comboMap[child.id] && !nodeMap[child.id]) return;
            treeChildren.push(child);
          });
        }

        c.minX = Infinity;
        c.minY = Infinity;
        c.maxX = -Infinity;
        c.maxY = -Infinity;
        treeChildren.forEach((child: any) => {
          if (child.itemType !== 'node') return true; // skip it
          const node = nodeMap[child.id];
          if (!node) return true; // means it is hidden
          const r = nodeSize(node);
          const nodeMinX = node.x - r;
          const nodeMinY = node.y - r;
          const nodeMaxX = node.x + r;
          const nodeMaxY = node.y + r;
          if (c.minX > nodeMinX) c.minX = nodeMinX;
          if (c.minY > nodeMinY) c.minY = nodeMinY;
          if (c.maxX < nodeMaxX) c.maxX = nodeMaxX;
          if (c.maxY < nodeMaxY) c.maxY = nodeMaxY;
        });
        let minSize = this.oriComboMap[treeNode.id].size || 10;
        if (isArray(minSize)) minSize = minSize[0];
        const maxLength = Math.max(c.maxX - c.minX, c.maxY - c.minY, minSize as number);
        c.r = maxLength / 2 + comboSpacing(c) / 2 + comboPadding(c);

        return true;
      });
    });
  }

  /**
   * prevent the overlappings among combos
   */
  private comboNonOverlapping(displacements: Point[], comboMap: ComboMap) {
    const comboTree = this.comboTree;
    const comboCollideStrength = this.option.comboCollideStrength as number;
    const indexMap = this.indexMap;
    const nodeMap = this.nodeMap;

    traverseTreeUp<ComboTree>(comboTree, (treeNode) => {
      if (!comboMap[treeNode.id] && !nodeMap[treeNode.id] && treeNode.id !== 'comboTreeRoot') {
        return false;
      } // means it is hidden
      const children = treeNode.children;
      // 同个子树下的子 combo 间两两对比
      if (children && children.length > 1) {
        children.forEach((v, i) => {
          if (v.itemType === 'node') return false; // skip it
          const cv: any = comboMap[v.id];
          if (!cv) return; // means it is hidden, skip it
          children.forEach((u, j) => {
            if (i <= j) return false;
            if (u.itemType === 'node') return false; // skip it
            const cu: any = comboMap[u.id];
            if (!cu) return false; // means it is hidden, skip it
            const vx = cv.cx - cu.cx || 0.005;
            const vy = cv.cy - cu.cy || 0.005;
            const l = vx * vx + vy * vy;
            const rv = (cv.r as number) || 1;
            const ru = (cu.r as number) || 1;
            const r = rv + ru;
            const ru2 = ru * ru;
            const rv2 = rv * rv;
            // overlapping
            if (l < r * r) {
              const vnodes = v.children;
              if (!vnodes || vnodes.length === 0) return false; // skip it
              const unodes = u.children;
              if (!unodes || unodes.length === 0) return false; // skip it
              const sqrtl = Math.sqrt(l);
              const ll = ((r - sqrtl) / sqrtl) * comboCollideStrength;
              const xl = vx * ll;
              const yl = vy * ll;
              const rratio = ru2 / (rv2 + ru2);
              const irratio = 1 - rratio;
              // 两兄弟 combo 的子节点上施加斥力
              vnodes.forEach((vn) => {
                if (vn.itemType !== 'node') return false; // skip it
                if (!nodeMap[vn.id]) return; // means it is hidden, skip it
                const vindex = indexMap[vn.id];
                unodes.forEach((un) => {
                  if (un.itemType !== 'node') return false;
                  if (!nodeMap[un.id]) return false; // means it is hidden, skip it
                  const uindex = indexMap[un.id];
                  displacements[vindex].x += xl * rratio;
                  displacements[vindex].y += yl * rratio;
                  displacements[uindex].x -= xl * irratio;
                  displacements[uindex].y -= yl * irratio;
                });
              });
            }
          });
        });
      }
      return true;
    });
  }

  /**
   * Calculate the repulsive force between each node pair
   * @param displacements The array stores the displacements for nodes
   * @param vecMap The map stores vector between each node pair
   */
  private calRepulsive(displacements: Point[], vecMap: any) {
    const { nodes } = this.data;
    const {
      width,
      optimizeRangeFactor,
      alpha,
      nodeCollideStrength,
      center,
      preventNodeOverlap,
      nodeSize,
      nodeSpacing,
      depthRepulsiveForceScale,
      gravity,
    } = this.option;
    const nodeSizeFunc = nodeSize as (d: any) => number;
    const nodeSpacingFunc = nodeSpacing as (d: any) => number;
    const nodeStrength = this.option.nodeStrength as (d: any) => number;
    const max = width * optimizeRangeFactor;
    const scale = depthRepulsiveForceScale;
    nodes.forEach((v: Node, i) => {
      if (!v.x || !v.y) return;

      // center gravity
      if (center) {
        const vecX = v.x - center[0] || 0.005;
        const vecY = v.y - center[1] || 0.005;
        const l = Math.sqrt(vecX * vecX + vecY * vecY);
        displacements[i].x -= (vecX * gravity * alpha) / l;
        displacements[i].y -= (vecY * gravity * alpha) / l;
      }

      nodes.forEach((u: Node, j) => {
        if (i === j) {
          return;
        }
        if (!u.x || !u.y) return;
        const { vl2, vl } = vecMap[`${v.id}-${u.id}`];
        if (vl > max) return;

        const { vx, vy } = vecMap[`${v.id}-${u.id}`];

        let depthDiff = Math.log(Math.abs(u.depth - v.depth) / 10) + 1 || 1;
        depthDiff = depthDiff < 1 ? 1 : depthDiff;
        if (u.comboId !== v.comboId) depthDiff += 1;
        const depthParam = depthDiff ? scale ** depthDiff : 1;

        const params = ((nodeStrength(u) * alpha) / vl2) * depthParam;
        displacements[i].x += vx * params;
        displacements[i].y += vy * params;

        // prevent node overlappings
        if (i < j && preventNodeOverlap) {
          const ri = nodeSizeFunc(v) + nodeSpacingFunc(v) || 1;
          const rj = nodeSizeFunc(u) + nodeSpacingFunc(u) || 1;
          const r = ri + rj;
          if (vl2 < r * r) {
            const ll = ((r - vl) / vl) * nodeCollideStrength;
            const rj2 = rj * rj;
            let rratio = rj2 / (ri * ri + rj2);
            const xl = vx * ll;
            const yl = vy * ll;
            displacements[i].x += xl * rratio;
            displacements[i].y += yl * rratio;
            rratio = 1 - rratio;
            displacements[j].x -= xl * rratio;
            displacements[j].y -= yl * rratio;
          }
        }
      });
    });
  }

  /**
   * Calculate the attractive force between the node pair with edge
   * @param displacements The array stores the displacements for nodes
   * @param vecMap The map stores vector between each node pair
   */
  private calAttractive(displacements: Point[], vecMap: any) {
    const edges = this.data.edges;
    const linkDistance = this.option.linkDistance as (d?: unknown) => number;
    const alpha = this.option.alpha;
    const edgeStrength = this.option.edgeStrength as (d?: unknown) => number;
    const bias = this.bias;
    const scale = this.option.depthAttractiveForceScale;
    edges.forEach((e, i) => {
      const source = getEdgeTerminal(e, 'source');
      const target = getEdgeTerminal(e, 'target');
      if (!source || !target || source === target) return;
      const uIndex = this.indexMap[source];
      const vIndex = this.indexMap[target];
      const u: Node = this.nodeMap[source];
      const v: Node = this.nodeMap[target];
      if (!u || !v) return;

      let depthDiff = u.depth === v.depth ? 0 : Math.log(Math.abs(u.depth - v.depth) / 10);
      if (u.comboId === v.comboId) {
        depthDiff = depthDiff / 2;
      }
      let depthParam = depthDiff ? scale ** depthDiff : 1;
      if (u.comboId !== v.comboId && depthParam === 1) {
        depthParam = scale / 2;
      } else if (u.comboId === v.comboId) {
        depthParam = 2;
      }

      if (!isNumber(v.x) || !isNumber(u.x) || !isNumber(v.y) || !isNumber(u.y)) {
        return;
      }
      const { vl, vx, vy } = vecMap[`${target}-${source}`];
      const l = ((vl - linkDistance(e)) / vl) * alpha * edgeStrength(e) * depthParam;
      const vecX = vx * l;
      const vecY = vy * l;

      const b = bias[i];
      displacements[vIndex].x -= vecX * b;
      displacements[vIndex].y -= vecY * b;
      displacements[uIndex].x += vecX * (1 - b);
      displacements[uIndex].y += vecY * (1 - b);
    });
  }
}
