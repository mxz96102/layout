import type { PointTuple, Node, NodeSize } from 'layouts/types';
import { getNodeDegreeMap, getNodeSize, sum } from '../util';
import {  Layout, LayoutOption } from './Layout';

// 1.0.0 变动
// 原来的布局没有实现防重叠，所以新的布局里面改为rowGap和colGap来控制行列的距离，nodeSize来控制节点的大小

export type GridLayoutOptions = {
  /**
   * @description width of the position range
   * @description.zh-CN 布局的宽度
   */
  width?: number;
  /**
   * @description height of the position range
   * @description.zh-CN 布局的高度
   */
  height?: number;
  /**
   * @description begin point of the first node
   * @description.zh-CN 第一个节点的起始点
   */
  begin?: PointTuple;
  /**
   * @description when set to true, cell will be condensed to the minimum and only spacing will count
   * @description.zh-CN 设置为true时，单元格将被紧凑到最小值，只有间距距离会被计算
   */
  condense?: boolean;
  /**
   * @description expected num of rows in the grid
   * @description.zh-CN 期望中布局中的行数
   */
  rows?: number;
  /**
   * @description expected num of columns in the grid
   * @description.zh-CN 期望中布局中的列数
   */
  cols?: number;
  /**
   * @description spacing between rows
   * @description.zh-CN 行之间的间距
   */
  rowGap?: number;
  /**
   * @description spacing between columns
   * @description.zh-CN 列之间的间距
   */
  colGap?: number;
  /**
   * @description nodeSize: radius or [width, height] or function(node)
   * @description.zh-CN 节点的大小：半径 或[宽度，高度]或返回前两者的函数
   */
  nodeSize?: NodeSize;
  /**
   * @description align for row
   * @description.zh-CN 行的对齐方式
   */
  rowAlign?: 'top' | 'center' | 'bottom';
  /**
   * @description align for column
   * @description.zh-CN 列的对齐方式
   */
  colAlign?: 'left' | 'center' | 'right';
  /**
   * @description data key in node used to sort nodes (when set to degree, nodes will be sorted by edges its connected to)
   * @description.zh-CN 节点的数据键，用于排序节点（当设置为degree时，节点将按照其连接的边的数量排序）
   */
  sortBy?: string;
  /**
   * @description optimize grid size to fit nodes
   * @description.zh-CN 尽可能的调整网格大小以适应节点数量
   */
  optimizeGrid?: boolean;
  workerEnabled?: boolean;
  position?: ((node: Node) => { row?: number; col?: number }) | undefined;
} & LayoutOption;

export const defaultGridLayoutOption: GridLayoutOptions = {
  rowGap: 10,
  colGap: 10,
  begin: [0, 0],
  width: 400,
  height: 400
};

export default class GridLayout extends Layout {
  option: GridLayoutOptions = {...defaultGridLayoutOption}

  constructor(option?: GridLayoutOptions) {
    super();
    this.updateCfg(option)
  }
    
  getDefaultCfg() {
    return { ... defaultGridLayoutOption };
  }

  public execute() {
    const { nodes, edges = [] } = this.data;
    const nodesCount = nodes?.length;
    const { begin } = this.option;

    // when no nodes, return
    if (!nodesCount) {
      return this.data;
    }

    // when only one node, set begin point to the only node
    if (nodesCount === 1) {
      const onlyNode = nodes[0];
      [onlyNode.x, onlyNode.y] = begin;
      return this.data;
    }

    const {
      width,
      height,
      condense,
      rows,
      cols,
      sortBy,
      position,
      rowGap,
      colGap,
      optimizeGrid,
      nodeSize,
      rowAlign,
      colAlign,
    } = this.option;

    let sortKey = sortBy;

    if (!sortKey || typeof sortKey !== 'string') {
      sortKey = 'degree';
    }

    let sortedNodes = nodes;

    // pre sort nodes by sortKey

    if (sortKey === 'degree') {
      // prepare degree map
      const degreeMap = getNodeDegreeMap(edges);
      // sort nodes by degree
      sortedNodes = nodes.sort((a, b) => {
        return degreeMap[a.id] - degreeMap[b.id];
      });
    } else {
      // sort nodes by data key
      sortedNodes = nodes.sort((a, b) => {
        const aData = a[sortKey];
        const bData = b[sortKey];
        return aData - bData;
      });
    }

    // prepare grid params

    // there will be same cells as many as nodes;
    const cellNum = nodesCount;
    let [rowNum, colNum] = [rows, cols];

    // when rows and cols are not set, calculate them
    if (!rowNum && colNum) {
      rowNum = Math.ceil(cellNum / colNum);
    } else if (rowNum && !colNum) {
      colNum = Math.ceil(cellNum / rowNum);
    } else if (!rowNum && !colNum) {
      rowNum = Math.ceil(Math.sqrt(cellNum));
      colNum = Math.ceil(cellNum / rowNum);
    }

    if (optimizeGrid) {
      // when optimizeGrid is true, optimize grid size to fit nodes
      // add or remove rows or cols when it's num are larger
      if (rowNum * colNum < cellNum) {
        while (rowNum * colNum < cellNum) {
          if (rowNum > colNum) {
            rowNum++;
          } else {
            colNum++;
          }
        }
      } else if (rowNum * colNum > cellNum) {
        while (rowNum * colNum > cellNum) {
          if (rowNum > colNum) {
            rowNum--;
          } else {
            colNum--;
          }
        }
      }
    }

    // prepare grid size
    let cellWidth = 0;
    let cellHeight = 0;

    if (!condense) {
      const realWidth = width - colGap * (colNum - 1);
      const realHeight = height - rowGap * (rowNum - 1);
      cellWidth = realWidth / colNum;
      cellHeight = realHeight / rowNum;
    }

    const rowHeights = [];
    const colWidths = [];
    const positionMap = [];
    const usedMap = {};
    let nowRow = 0;
    let nowCol = 0;

    for (let index = 0; index < sortedNodes.length; index++) {
      const node = sortedNodes[index];
      if (position) {
        const { row, col } = position(node) || {};
        if (row > -1 && col > -1) {
          positionMap[node.id] = { row, col };
        } else {
          positionMap[node.id] = { row: nowRow, col: nowCol };
        }
      } else {
        positionMap[node.id] = { row: nowRow, col: nowCol };
      }

      const nowPos = positionMap[node.id];
      let [nodeHeight, nodeWidth] = [cellHeight, cellWidth];

      if (nodeSize) {
        [nodeWidth, nodeHeight] = getNodeSize(nodeSize, node);
      }

      rowHeights[nowPos.row] = Math.max(nodeHeight, rowHeights[nowPos.row] || 0);
      colWidths[nowPos.col] = Math.max(nodeWidth, colWidths[nowPos.col] || 0);

      usedMap[nowPos.row + '-' + nowPos.col] = { node, height: nodeHeight, width: nodeWidth };

      while (usedMap[nowRow + '-' + nowCol]) {
        nowCol++;
        if (nowCol > colNum - 1) {
          nowCol = 0;
          nowRow++;
        }
      }
    }


    // set node position
    for (let index = 0; index < sortedNodes.length; index++) {
      const node = sortedNodes[index];
      const nowPos = positionMap[node.id];
      const used = usedMap[nowPos.row + '-' + nowPos.col];
      const [prevHeight, prevWidth] = [sum(rowHeights, nowPos.row), sum(colWidths, nowPos.col)];
      const [currentHeight, currentWidth] = [rowHeights[nowPos.row], colWidths[nowPos.col]];
      const [cellX, cellY] = [begin[0] + prevWidth + nowPos.col * colGap, begin[1] + prevHeight + nowPos.row * rowGap];
      const [nodeHeight, nodeWidth] = [used.height, used.width];

      switch (rowAlign) {
        case 'top':
          node.y = cellY + nodeHeight / 2;
          break;
        case 'bottom':
          node.y = cellY + (currentHeight - nodeHeight) / 2;
          break;
        case 'center':
        default:
          node.y = cellY + currentHeight / 2;
      }
      switch (colAlign) {
        case 'left':
          node.x = cellX + nodeWidth / 2;
          break;
        case 'right':
          node.x = cellX + (currentWidth - nodeWidth) / 2;
          break;
        case 'center':
        default:
          node.x = cellX + currentWidth / 2;
          break;
      }

    }

    return this.data;
  }
}
