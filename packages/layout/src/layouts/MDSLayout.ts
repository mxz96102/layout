import { Matrix as MLMatrix, SingularValueDecomposition } from 'ml-matrix';
import { PointTuple, Matrix } from './types';
import { floydWarshall, getAdjMatrix, scaleMatrix } from '../util';
import {  Layout, LayoutOption } from './Layout';

export type MDSLayoutOptions = {
  center?: PointTuple;
  linkDistance?: number;
  distances?: Matrix[];
} & LayoutOption;

export const defaultMDSLayoutOption: MDSLayoutOptions = {
  center: [0, 0],
  linkDistance: 10,
};

export default class MDSLayout extends Layout {
  option: MDSLayoutOptions = { ...defaultMDSLayoutOption };

  getDefaultCfg() {
    return { ...defaultMDSLayoutOption };
  }

  constructor(option?: MDSLayoutOptions) {
    super();
    this.updateCfg(option);
  }

  public execute() {
    const { nodes, edges = [] } = this.data;
    const { center, linkDistance, distances: optionDistances } = this.option;
    if (!nodes || nodes.length === 0) {
      return;
    }
    if (nodes.length === 1) {
      nodes[0].x = center[0];
      nodes[0].y = center[1];
      return;
    }

    // the graph-theoretic distance (shortest path distance) matrix
    const adjMatrix = getAdjMatrix({ nodes, edges }, false);
    const distances = optionDistances || floydWarshall(adjMatrix);
    this.handleInfinity(distances);

    // scale the ideal edge length acoording to linkDistance
    const scaledD = scaleMatrix(distances, linkDistance);

    // get positions by MDS
    const positions = this.runMDS(scaledD);
    positions.forEach((p: number[], i: number) => {
      nodes[i].x = p[0] + center[0];
      nodes[i].y = p[1] + center[1];
    });
    return this.data;
  }

  /**
   * mds 算法
   * @return {array} positions 计算后的节点位置数组
   */
  public runMDS(distances): PointTuple[] {
    const dimension = 2;

    // square distances
    const M = MLMatrix.mul(MLMatrix.pow(distances, 2), -0.5);

    // double centre the rows/columns
    const rowMeans = M.mean('row');
    const colMeans = M.mean('column');
    const totalMean = M.mean();
    M.add(totalMean).subRowVector(rowMeans).subColumnVector(colMeans);

    // take the SVD of the double centred matrix, and return the
    // points from it
    const ret = new SingularValueDecomposition(M);
    const eigenValues = MLMatrix.sqrt(ret.diagonalMatrix).diagonal();
    return ret.leftSingularVectors.toJSON().map((row: number[]) => {
      return MLMatrix.mul([row], [eigenValues]).toJSON()[0].splice(0, dimension) as PointTuple;
    });
  }

  public handleInfinity(distances: Matrix[]) {
    let maxDistance = -999999;
    distances.forEach((row) => {
      row.forEach((value) => {
        if (value === Infinity) {
          return;
        }
        if (maxDistance < value) {
          maxDistance = value;
        }
      });
    });
    distances.forEach((row, i) => {
      row.forEach((value, j) => {
        if (value === Infinity) {
          distances[i][j] = maxDistance;
        }
      });
    });
  }
}
