import { Model, Node, PointTuple, Edge } from 'layouts/types';
import { algorithm, Graph } from '@antv/graphlib';
import {  Layout, LayoutOption } from './Layout';

const initGraph = (nodes: Node[], edges: Edge[], directed: boolean) => {
  // create a graph
  const graph = new Graph({
    directed,
  });

  nodes.forEach((node) => graph.setNode(node.id, node));

  edges.forEach((edge) => graph.setEdge(edge.source, edge.target, edge));

  return graph;
};

const topologySort = (graph: Graph) => {
  try {
    return algorithm.topsort(graph as any).map((id: string) => graph.node(id) as Node);
  } catch (e) {
    // clean circle in graph
    let circles = algorithm.findCycles(graph as any);

    while (circles.length) {
      circles.forEach((circle: string[]) => {
        const a = circle[0];
        const b = circle[1];
        graph.removeEdge(a, b);
      });
      circles = algorithm.findCycles(graph as any);
    }

    const g = algorithm.topsort(graph as any);

    return g.map((id: string) => graph.node(id) as Node);
  }
};

export type CircularLayoutOptions = {
  /**
   * @description center of layout
   * @description.zh-CN 布局的中心
   */
  center?: PointTuple;
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
   * @description radius of layout
   * @description.zh-CN 布局的半径
   */
  radius?: number | null;
  /**
   * @description start radius of layout
   * @description.zh-CN 布局的起始半径
   */
  startRadius?: number | null;
  /**
   * @description end radius of layout
   * @description.zh-CN 布局的结束半径
   */
  endRadius?: number | null;
  /**
   * @description should layout run in clockwise direction
   * @description.zh-CN 是否顺时针运行布局
   */
  clockwise?: boolean;
  /**
   * @description how many segments should be used to divide the circle, when endRadius - startRadius != 0
   * @description.zh-CN 节点在环上分成段数（几个段将均匀分布），在 endRadius - startRadius != 0 时生效
   */
  divisions?: number;
  /**
   * @description how to sort nodes
   * @description.zh-CN 节点排序方式
   */
  ordering?: 'topology' | 'topology-directed' | 'degree' | null;
  /**
   * @description how many circles should layout go through from first to last
   * @description.zh-CN 布局从第一个点到最后一个点将要走几个圆
   */
  angleRatio?: number;
  /**
   * @description start angle of layout
   * @description.zh-CN 布局的起始角度
   */
  startAngle?: number;
  /**
   * @description end angle of layout
   * @description.zh-CN 布局的结束角度
   */
  endAngle?: number;
} & LayoutOption;

const defaultCircularLayoutOptions: CircularLayoutOptions = {};

export default class CircularLayout extends Layout {
  option: CircularLayoutOptions = { ...defaultCircularLayoutOptions };

  constructor(options?: CircularLayoutOptions) {
    super();
    this.updateCfg(options);
  }

  getDefaultCfg() {
    return { ...defaultCircularLayoutOptions };
  }

  public execute() {
    const { nodes = [], edges = [] } = this.data;
    const nodesCount = nodes.length;

    // if no nodes, layout ends
    if (nodesCount === 0) {
      return this.data;
    }

    const { center: optionCenter, width, height } = this.option;

    const center = optionCenter || [width / 2, height / 2];

    // if only one node, layout ends
    if (nodesCount === 1) {
      nodes[0].x = center[0];
      nodes[0].y = center[1];
      return this.data;
    }

    let { radius, startRadius, endRadius } = this.option;
    const { divisions, startAngle, endAngle, angleRatio, ordering, clockwise } = this.option;
    const angleStep = (endAngle - startAngle) / nodesCount;

    if (!radius && !startRadius && !endRadius) {
      radius = Math.min(width, height) / 2;
    } else if (!startRadius && endRadius) {
      startRadius = endRadius;
    } else if (startRadius && !endRadius) {
      endRadius = startRadius;
    }

    const astep = angleStep * angleRatio;

    let layoutNodes: Node[] = [];
    const directed = ordering === 'topology-directed';
    const graph = initGraph(nodes, edges, directed);
    if (ordering === 'topology') {
      layoutNodes = topologySort(graph);
    } else if (ordering === 'topology-directed') {
      layoutNodes = topologySort(graph);
    } else if (ordering === 'degree') {
      // layout according to the descent order of degrees
      layoutNodes = graph
        .nodes()
        .sort((a, b) => graph.nodeDegree(b) - graph.nodeDegree(a))
        .map((e: string) => graph.node(e) as Node);
    } else {
      // layout according to the original order in the data.nodes
      layoutNodes = nodes;
    }

    const divN = Math.ceil(nodesCount / divisions); // node number in each division
    for (let i = 0; i < nodesCount; ++i) {
      let r = radius;
      if (!r && startRadius !== null && endRadius !== null) {
        r = startRadius + (i * (endRadius - startRadius)) / (nodesCount - 1);
      }
      if (!r) {
        r = 10 + (i * 100) / (nodesCount - 1);
      }
      let angle = startAngle + (i % divN) * astep + ((2 * Math.PI) / divisions) * Math.floor(i / divN);
      if (!clockwise) {
        angle = endAngle - (i % divN) * astep - ((2 * Math.PI) / divisions) * Math.floor(i / divN);
      }
      layoutNodes[i].x = center[0] + Math.cos(angle) * r;
      layoutNodes[i].y = center[1] + Math.sin(angle) * r;
    }

    return this.data;
  }
}
