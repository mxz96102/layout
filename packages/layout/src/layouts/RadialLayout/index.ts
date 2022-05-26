import { PointTuple, Node, OutNode, Matrix, NodeSize, NodeSpace } from '../types';
import { isArray, isFunction, isNumber, isString, floydWarshall, getAdjMatrix, isObject } from '../../util';
import {Layout, LayoutOption} from '../Layout';
import MDSLayout from '../MDSLayout';
import RadialNonoverlapForce, { RadialNonoverlapForceParam } from './radialNonoverlapForce';

type INode = OutNode & {
  size?: number | PointTuple;
};

function getWeightMatrix(M: Matrix[]) {
  const rows = M.length;
  const cols = M[0].length;
  const result = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      if (M[i][j] !== 0) {
        row.push(1 / (M[i][j] * M[i][j]));
      } else {
        row.push(0);
      }
    }
    result.push(row);
  }
  return result;
}

function getIndexById(array: any[], id: string) {
  let index = -1;
  array.forEach((a, i) => {
    if (a.id === id) {
      index = i;
    }
  });
  return index;
}

function getEDistance(p1: PointTuple, p2: PointTuple) {
  return Math.sqrt((p1[0] - p2[0]) * (p1[0] - p2[0]) + (p1[1] - p2[1]) * (p1[1] - p2[1]));
}

export type RadialLayoutOptions = {
  center?: PointTuple;
  width?: number;
  height?: number;
  linkDistance?: number;
  maxIteration?: number;
  focusNode?: string | Node | null;
  unitRadius?: number | null;
  preventOverlap?: boolean;
  nodeSize?: NodeSize;
  nodeSpacing?: NodeSpace;
  maxPreventOverlapIteration?: number;
  strictRadial?: boolean;
  sortBy?: string | undefined;
  sortStrength?: number;
  workerEnabled?: boolean;
} & LayoutOption;

export const defaultRadialOptions = {
  maxIteration: 1000,
  focusNode: null,
  unitRadius: null,
  linkDistance: 50,
  preventOverlap: false,
  nodeSize: undefined,
  nodeSpacing: undefined,
  strictRadial: true,
  maxPreventOverlapIteration: 200,
  sortBy: undefined,
  sortStrength: 10,
  width: 500,
  height: 500,
};

/**
 * 辐射状布局
 */
export default class RadialLayout extends Layout {
  option: RadialLayoutOptions;

  constructor(options?: RadialLayoutOptions) {
    super();
    this.updateCfg(options);
  }

  public getDefaultCfg() {
    return;
  }

  /**
   * 执行布局
   */
  public execute() {
    const { nodes, edges } = this.data;
    if (!nodes || nodes.length === 0) {
      return;
    }
    const {
      width,
      height,
      center: originCenter,
      linkDistance,
      nodeSize,
      nodeSpacing,
      preventOverlap,
      strictRadial,
      maxPreventOverlapIteration,
    } = this.option;
    let { unitRadius } = this.option;
    const center = originCenter || [width / 2, height / 2];

    if (nodes.length === 1) {
      nodes[0].x = center[0];
      nodes[0].y = center[1];
      return;
    }
    let { focusNode } = this.option;

    if (isString(focusNode)) {
      let found = false;
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === focusNode) {
          focusNode = nodes[i];
          found = true;
          i = nodes.length;
        }
      }
      if (!found) {
        focusNode = null;
      }
    }

    // default focus node
    if (!focusNode) {
      focusNode = nodes[0];
    }
    // the index of the focusNode in data
    let focusIndex = getIndexById(nodes, (focusNode as Node).id);
    if (focusIndex < 0) focusIndex = 0;

    // the graph-theoretic distance (shortest path distance) matrix
    const adjMatrix = getAdjMatrix({ nodes, edges }, false);
    const D = floydWarshall(adjMatrix);
    const maxDistance = this.maxToFocus(D, focusIndex);
    // replace first node in unconnected component to the circle at (maxDistance + 1)
    this.handleInfinity(D, focusIndex, maxDistance + 1);
    const distances = D;

    // the shortest path distance from each node to focusNode
    const focusNodeD = D[focusIndex];
    let semiWidth = width - center[0] > center[0] ? center[0] : width - center[0];
    let semiHeight = height - center[1] > center[1] ? center[1] : height - center[1];
    if (semiWidth === 0) {
      semiWidth = width / 2;
    }
    if (semiHeight === 0) {
      semiHeight = height / 2;
    }
    // the maxRadius of the graph
    const maxRadius = semiHeight > semiWidth ? semiWidth : semiHeight;
    const maxD = Math.max(...focusNodeD);
    // the radius for each nodes away from focusNode
    const radii: number[] = [];
    focusNodeD.forEach((value, i) => {
      if (!unitRadius) {
        unitRadius = maxRadius / maxD;
      }
      radii[i] = value * unitRadius;
    });

    const eIdealD = this.eIdealDisMatrix(nodes, distances, radii);
    // const eIdealD = scaleMatrix(D, linkDistance);
    // the weight matrix, Wij = 1 / dij^(-2)
    const weights = getWeightMatrix(eIdealD);

    // the initial positions from mds
    const mds = new MDSLayout({ linkDistance, distances: eIdealD });
    mds.layout({ nodes, edges });
    const nowFocusNode = nodes[focusIndex];
    nodes.forEach((node) => {
      node.x = node.x + center[0] - nowFocusNode.x;
      node.y = node.y + center[1] - nowFocusNode.y;
    });
    this.run(this.data, {
      radii,
      weights,
      eIdealDis: eIdealD,
    });
    // stagger the overlapped nodes
    if (preventOverlap) {
      let nodeSpacingFunc;
      let nodeSizeFunc;
      if (isNumber(nodeSpacing)) {
        nodeSpacingFunc = () => nodeSpacing;
      } else if (isFunction(nodeSpacing)) {
        nodeSpacingFunc = nodeSpacing;
      } else {
        nodeSpacingFunc = () => 0;
      }
      if (!nodeSize) {
        nodeSizeFunc = (d: INode) => {
          if (d.size) {
            if (isArray(d.size)) {
              const res = d.size[0] > d.size[1] ? d.size[0] : d.size[1];
              return res + nodeSpacingFunc(d);
            }
            if (isObject(d.size)) {
              const res = d.size.width > d.size.height ? d.size.width : d.size.height;
              return res + nodeSpacingFunc(d);
            }
            return d.size + nodeSpacingFunc(d);
          }
          return 10 + nodeSpacingFunc(d);
        };
      } else if (isArray(nodeSize)) {
        nodeSizeFunc = (d: INode) => {
          const res = nodeSize[0] > nodeSize[1] ? nodeSize[0] : nodeSize[1];
          return res + nodeSpacingFunc(d);
        };
      } else {
        nodeSizeFunc = (d: INode) => nodeSize + nodeSpacingFunc(d);
      }
      const nonoverlapForceParams: RadialNonoverlapForceParam = {
        nodes,
        nodeSizeFunc,
        adjMatrix,
        positions: nodes.map((node) => [node.x, node.y]),
        radii,
        height,
        width,
        strictRadial,
        focusID: focusIndex,
        iterations: maxPreventOverlapIteration || 200,
        k: nodes.length / 4.5,
      };
      const nonoverlapForce = new RadialNonoverlapForce(nonoverlapForceParams);
      const positions = nonoverlapForce.layout();
      // move the graph to center
    positions.forEach((p: PointTuple, i: number) => {
      nodes[i].x = p[0] + center[0];
      nodes[i].y = p[1] + center[1];
    });
    }
    

    return {
      nodes,
      edges,
    };
  }

  public run(data, context) {
    const { nodes } = data;
    const { maxIteration } = this.option;
    const { weights = [], radii = [], eIdealDis = [] } = context;

    for (let i = 0; i <= maxIteration; i++) {
      const param = i / maxIteration;
      this.oneIteration(param, nodes, radii, eIdealDis, weights);
    }
  }

  private oneIteration(param: number, nodes: Node[], radii: number[], D: Matrix[], W: Matrix[], focusIndex = 0) {
    const vparam = 1 - param;
    nodes.forEach((n: Node, i: number) => {
      // v
      const v: PointTuple = [n.x, n.y];
      const originDis = getEDistance(v, [0, 0]);
      const reciODis = originDis === 0 ? 0 : 1 / originDis;
      if (i === focusIndex) {
        return;
      }
      let xMolecule = 0;
      let yMolecule = 0;
      let denominator = 0;
      nodes.forEach((nn, j) => {
        // u
        const u: PointTuple = [nn.x, nn.y];
        if (i === j) {
          return;
        }
        // the euclidean distance between v and u
        const edis = getEDistance(v, u);
        const reciEdis = edis === 0 ? 0 : 1 / edis;
        const idealDis = D[j][i];
        // same for x and y
        denominator += W[i][j];
        // x
        xMolecule += W[i][j] * (u[0] + idealDis * (v[0] - u[0]) * reciEdis);
        // y
        yMolecule += W[i][j] * (u[1] + idealDis * (v[1] - u[1]) * reciEdis);
      });
      const reciR = radii[i] === 0 ? 0 : 1 / radii[i];
      denominator *= vparam;
      denominator += param * reciR * reciR;
      // x
      xMolecule *= vparam;
      xMolecule += param * reciR * v[0] * reciODis;
      v[0] = xMolecule / denominator;
      // y
      yMolecule *= vparam;
      yMolecule += param * reciR * v[1] * reciODis;
      v[1] = yMolecule / denominator;
    });
  }

  private eIdealDisMatrix(nodes: Node[], distances: Matrix[], radii: number[]): Matrix[] {
    if (!nodes) return [];
    const D = distances;
    const { sortBy, sortStrength } = this.option;
    const linkDis = this.option.linkDistance;
    const unitRadius = this.option.unitRadius || 50;
    const result: Matrix[] = [];
    if (D) {
      D.forEach((row, i) => {
        const newRow: Matrix = [];
        row.forEach((v, j) => {
          if (i === j) {
            newRow.push(0);
          } else if (radii[i] === radii[j]) {
            // i and j are on the same circle
            if (sortBy === 'data') {
              // sort the nodes on the same circle according to the ordering of the data
              newRow.push((v * (Math.abs(i - j) * sortStrength)) / (radii[i] / unitRadius));
            } else if (sortBy) {
              // sort the nodes on the same circle according to the attributes
              let iValue: number | string = ((nodes[i] as any)[sortBy] as number | string) || 0;
              let jValue: number | string = ((nodes[j] as any)[sortBy] as number | string) || 0;
              if (isString(iValue)) {
                iValue = iValue.charCodeAt(0);
              }
              if (isString(jValue)) {
                jValue = jValue.charCodeAt(0);
              }
              newRow.push((v * (Math.abs(iValue - jValue) * sortStrength)) / (radii[i] / unitRadius));
            } else {
              newRow.push((v * linkDis) / (radii[i] / unitRadius));
            }
          } else {
            // i and j are on different circle
            // i and j are on different circle
            const link = (linkDis + unitRadius) / 2;
            newRow.push(v * link);
          }
        });
        result.push(newRow);
      });
    }
    return result;
  }

  private handleInfinity(matrix: Matrix[], focusIndex: number, step: number) {
    const length = matrix.length;
    // 遍历 matrix 中遍历 focus 对应行
    for (let i = 0; i < length; i++) {
      // matrix 关注点对应行的 Inf 项
      if (matrix[focusIndex][i] === Infinity) {
        matrix[focusIndex][i] = step;
        matrix[i][focusIndex] = step;
        // 遍历 matrix 中的 i 行，i 行中非 Inf 项若在 focus 行为 Inf，则替换 focus 行的那个 Inf
        for (let j = 0; j < length; j++) {
          if (matrix[i][j] !== Infinity && matrix[focusIndex][j] === Infinity) {
            matrix[focusIndex][j] = step + matrix[i][j];
            matrix[j][focusIndex] = step + matrix[i][j];
          }
        }
      }
    }
    // 处理其他行的 Inf。根据该行对应点与 focus 距离以及 Inf 项点 与 focus 距离，决定替换值
    for (let i = 0; i < length; i++) {
      if (i === focusIndex) {
        continue;
      }
      for (let j = 0; j < length; j++) {
        if (matrix[i][j] === Infinity) {
          let minus = Math.abs(matrix[focusIndex][i] - matrix[focusIndex][j]);
          minus = minus === 0 ? 1 : minus;
          matrix[i][j] = minus;
        }
      }
    }
  }

  private maxToFocus(matrix: Matrix[], focusIndex: number): number {
    let max = 0;
    for (let i = 0; i < matrix[focusIndex].length; i++) {
      if (matrix[focusIndex][i] === Infinity) {
        continue;
      }
      max = matrix[focusIndex][i] > max ? matrix[focusIndex][i] : max;
    }
    return max;
  }

  public getType() {
    return 'radial';
  }
}
