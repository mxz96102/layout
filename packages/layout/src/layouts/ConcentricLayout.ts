import { NodeSize, PointTuple } from 'layouts/types';
import { getNodeDegreeMap, getNodeSize } from '../util';
import { Layout, LayoutOption } from './Layout';

// 1.0.0 改动，当数据只能够构成一层的时候，应该是围绕最外层，所以之后只会有nodeSize和nodeSpacing控制间距，默认不会有节点重叠

export type ConcentricLayoutOptions = {
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
   * @description center of layout
   * @description.zh-CN 布局的中心
   */
  center?: PointTuple;
  /**
   * @description nodeSize: radius or [width, height] or function(node)
   * @description.zh-CN 节点的大小：半径 或[宽度，高度]或返回前两者的函数
   */
  nodeSize?: NodeSize;
  /**
   * @description spacing between nodes
   * @description.zh-CN 节点之间的间距
   */
  nodeSpacing?: number | ((node: any) => number);
  /**
   * @description data key in node used to sort nodes (when set to degree, nodes will be sorted by edges its connected to)
   * @description.zh-CN 节点的数据键，用于排序节点（当设置为degree时，节点将按照其连接的边的数量排序）
   */
  sortBy?: string;
  /**
   * @description the minimum distance between nodes
   * @description.zh-CN 节点之间的最小距离
   */
  minNodeSpacing?: number;
  /**
   * @description the radian distance between first and last node
   * @description.zh-CN 第一个和最后一个节点之间的弧度距离
   */
  sweep?: number;
  /**
   * @description should distance between each concentric circle be the same
   * @description.zh-CN 是否要求同心圆之间的距离相同
   */
  equidistant?: boolean;
  /**
   * @description the start angle
   * @description.zh-CN 开始角度
   */
  startAngle?: number;
  /**
   * @description should layout run in clockwise direction
   * @description.zh-CN 是否顺时针运行布局
   */
  clockwise?: boolean;
  /**
   * @description when nodes' value's difference is greater than this value, next node will be placed in next concentric circle
   * @description.zh-CN 当节点的值的差值大于此值时，下一个节点将被放置在下一个同心圆
   * @default maxValue / 4
   */
  maxLevelDiff?: number;
  optimizeLevel: boolean;
} & LayoutOption;

type ALevel = any[] & { firstNode?: any };

export const defaultConcentricLayoutOptions: ConcentricLayoutOptions = {
  nodeSize: 30,
  minNodeSpacing: 10,
  sweep: undefined,
  equidistant: false,
  startAngle: (3 / 2) * Math.PI,
  clockwise: true,
  maxLevelDiff: undefined,
  sortBy: 'degree',
  nodeSpacing: 10,
  optimizeLevel: false
};

export default class ConcentricLayout extends Layout {
  option: ConcentricLayoutOptions = { ...defaultConcentricLayoutOptions };

  constructor(option?: ConcentricLayoutOptions) {
    super();
    this.updateCfg(option);
  }

  getDefaultCfg() {
    return { ...defaultConcentricLayoutOptions };
  }

  public execute() {
    const { nodes = [], edges = [] } = this.data;
    const nodesCount = nodes.length;
    const { center: optionCenter } = this.option;

    const center = optionCenter || [this.option.width / 2, this.option.height / 2];

    if (nodesCount === 0) {
      return this.data;
    }

    if (nodesCount === 1) {
      nodes[0].x = center[0];
      nodes[0].y = center[1];
      return this.data;
    }

    const {
      sortBy,
      maxLevelDiff,
      width,
      height,
      minNodeSpacing,
      nodeSize,
      nodeSpacing,
      equidistant,
      startAngle,
      clockwise,
      sweep: optionSweep,
      optimizeLevel
    } = this.option;

    let sortKey = sortBy;
    let valueMap: { [key: string]: number } = {};

    if (!sortKey || typeof sortKey !== 'string') {
      sortKey = 'degree';
    }

    let sortFunc = (a, b) => b[sortKey] - a[sortKey];

    if (sortKey === 'degree') {
      valueMap = getNodeDegreeMap(edges);
      sortFunc = (a, b) => valueMap[b.id] - valueMap[a.id];
    }

    // sort nodes by value
    const sortedNodes = nodes.sort(sortFunc);

    const maxValueNode = sortedNodes[0];
    const maxValue = sortKey === 'degree' ? valueMap[maxValueNode.id] : maxValueNode[sortKey];


    const levelDiff = maxLevelDiff || maxValue / 4;

    const levels: ALevel[] = [[]];
    const nodesSpaceMap = {};
    const nodesSizeMap = {};
    let maxNodeSize = 0;
    let maxNodeSpacing = 0;

    if (nodeSize && typeof nodeSize !== 'function') {
      maxNodeSize = Math.max(...getNodeSize(nodeSize, { id: '0' }));
    }

    if (nodeSpacing && typeof nodeSpacing !== 'function') {
      maxNodeSpacing = nodeSpacing;
    }

    for (let i = 0; i < nodesCount; i += 1) {
      const node = sortedNodes[i];
      if (typeof nodeSize === 'function') {
        const size = getNodeSize(nodeSize, node);
        const usingSize = Math.max(...size);
        nodesSizeMap[node.id] = usingSize;
        maxNodeSize = Math.max(maxNodeSize, usingSize);
      }

      if (nodeSpacing && typeof nodeSpacing === 'function') {
        const spacing = nodeSpacing(node);

        nodesSpaceMap[node.id] = spacing;
        maxNodeSpacing = Math.max(maxNodeSpacing, spacing);
      }

      const currentLevel = levels[levels.length - 1];

      if (!currentLevel.firstNode) {
        currentLevel.firstNode = node;
      }
      const firstNode = currentLevel.firstNode;
      const firstNodeValue = sortKey === 'degree' ? valueMap[firstNode.id] : firstNode[sortKey];
      const nowNodeValue = sortKey === 'degree' ? valueMap[node.id] : node[sortKey];
      const diff = Math.abs(firstNodeValue - nowNodeValue);
      if (diff > levelDiff) {
        levels.push([node]);
      } else {
        currentLevel.push(node);
      }
    }


    if (optimizeLevel) {
      for (let i = 0; i < levels.length; i += 1) {
        const nowLevel = levels[i];
        const nextLevel = levels[i + 1];
  
        if (nowLevel && nextLevel) {
          if (i === 0) {
            while (nowLevel.length > 1) {
              nextLevel.unshift(nowLevel.pop());
            }
          } else {
            while ( Math.max(nextLevel.length / 1.5, 4) < nowLevel.length) {
              nextLevel.unshift(nowLevel.pop());
            }
          }
        }
      }
    }

    const minDistance = maxNodeSize + Math.max(maxNodeSpacing, minNodeSpacing);
    const firstLevelOnlyOneNode = levels[0]?.length === 1;
    const maxRadius = Math.min(width, height) / 2 - maxNodeSize;
    let r = firstLevelOnlyOneNode ? 0 : minDistance;
    const direction = clockwise ? 1 : -1;

    levels.forEach((level, i) => {
      const sweep = optionSweep || 2 * Math.PI - (2 * Math.PI) / level.length;
      let dTheta;
      let levelR;

      if (equidistant) {
        dTheta = sweep / Math.max(1, level.length - 1);
        levelR = (maxRadius / Math.max(levels.length, 1)) * (i);
      } else {
        dTheta = sweep / Math.max(1, level.length - 1);
        levelR = r;
        r += minDistance;
      }

      level.forEach((node, j) => {
        const theta = startAngle + direction * j * dTheta;
        const rx = levelR * Math.cos(theta);
        const ry = levelR * Math.sin(theta);

        node.x = center[0] + rx;
        node.y = center[1] + ry;
      });
    });

    return this.data;
  }
}
