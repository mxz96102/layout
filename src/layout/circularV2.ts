/**
 * @fileOverview random layout
 * @author shiwu.wyy@antfin.com
 */

import { Edge, PointTuple, CircularLayoutOptions } from "./types";
import { Base } from "./base";
import { getFuncByUnknownType } from "../util";
import { Graph, Node as N } from "./dagre/graph";
import { algorithm } from "@antv/graphlib";

type Node = N<{ id: string; weight: number }>;

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
    return algorithm
      .topsort(graph as any)
      .map((id: string) => graph.node(id) as Node);
  } catch (e) {}

  // clean circle in graph
  let circles = algorithm.findCycles(graph as any);

  while (circles.length) {
    circles.forEach((circle: string[]) => {
      const a = circle.pop()!;
      const b = circle.pop()!;
      graph.removeEdge(a, b);
    });
    circles = algorithm.findCycles(graph as any);
  }

  const g = algorithm.topsort(graph as any);

  return g.map((id: string) => graph.node(id) as Node);
};

/**
 * 圆形布局
 */
export class CircularLayout extends Base {
  /** 布局中心 */
  public center: PointTuple;

  /** 固定半径，若设置了 radius，则 startRadius 与 endRadius 不起效 */
  public radius: number | null = null;

  /** 节点间距，若设置 nodeSpacing，则 radius 将被自动计算，即设置 radius 不生效 */
  public nodeSpacing: ((d?: unknown) => number) | number | undefined;

  /** 节点大小，配合 nodeSpacing，一起用于计算 radius。若不配置，节点大小默认为 30 */
  public nodeSize: number | undefined = undefined;

  /** 起始半径 */
  public startRadius: number | null = null;

  /** 终止半径 */
  public endRadius: number | null = null;

  /** 起始角度 */
  public startAngle: number = 0;

  /** 终止角度 */
  public endAngle: number = 2 * Math.PI;

  /** 是否顺时针 */
  public clockwise: boolean = true;

  /** 节点在环上分成段数（几个段将均匀分布），在 endRadius - startRadius != 0 时生效 */
  public divisions: number = 1;

  /** 节点在环上排序的依据，可选: 'topology', 'degree', 'null' */
  public ordering: "topology" | "topology-directed" | "degree" | null = null;

  /** how many 2*pi from first to last nodes */
  public angleRatio = 1;

  public nodes: Node[] = [];

  public edges: Edge[] = [];

  public width: number = 300;

  public height: number = 300;

  public onLayoutEnd: () => void;

  constructor(options?: CircularLayoutOptions) {
    super();
    this.updateCfg(options);
  }

  public getDefaultCfg() {
    return {
      radius: null,
      startRadius: null,
      endRadius: null,
      startAngle: 0,
      endAngle: 2 * Math.PI,
      clockwise: true,
      divisions: 1,
      ordering: null,
      angleRatio: 1,
    };
  }

  /**
   * 执行布局
   */
  public execute() {
    const self = this;
    const nodes = self.nodes;
    const edges = self.edges;
    const n = nodes.length;

    // if no nodes, layout ends
    if (n === 0) {
      if (self.onLayoutEnd) self.onLayoutEnd();
      return;
    }

    if (!self.width && typeof window !== "undefined") {
      self.width = window.innerWidth;
    }
    if (!self.height && typeof window !== "undefined") {
      self.height = window.innerHeight;
    }

    if (!self.center) {
      self.center = [self.width / 2, self.height / 2];
    }

    const center = self.center;

    // if only one node, layout ends
    if (n === 1) {
      nodes[0].x = center[0];
      nodes[0].y = center[1];
      if (self.onLayoutEnd) self.onLayoutEnd();
      return;
    }

    let { radius, startRadius, endRadius } = self;
    const {
      divisions,
      startAngle,
      endAngle,
      angleRatio,
      ordering,
      clockwise,
      nodeSpacing: paramNodeSpacing,
      nodeSize: paramNodeSize,
    } = self;
    const angleStep = (endAngle - startAngle) / n;

    if (paramNodeSpacing) {
      const nodeSpacing: Function = getFuncByUnknownType(10, paramNodeSpacing);
      const nodeSize: Function = getFuncByUnknownType(10, paramNodeSize);
      let maxNodeSize = -Infinity;
      nodes.forEach((node) => {
        const nSize = nodeSize(node);
        if (maxNodeSize < nSize) maxNodeSize = nSize;
      });
      let length = 0;
      nodes.forEach((node, i) => {
        if (i === 0) length += maxNodeSize || 10;
        else length += (nodeSpacing(node) || 0) + (maxNodeSize || 10);
      });
      radius = length / (2 * Math.PI);
    } else if (!radius && !startRadius && !endRadius) {
      radius = self.height > self.width ? self.width / 2 : self.height / 2;
    } else if (!startRadius && endRadius) {
      startRadius = endRadius;
    } else if (startRadius && !endRadius) {
      endRadius = startRadius;
    }
    const astep = angleStep * angleRatio;

    let layoutNodes: Node[] = [];
    const directed = ordering === "topology-directed";
    const graph = initGraph(nodes, edges, directed);
    if (ordering === "topology") {
      layoutNodes = topologySort(graph);
    } else if (ordering === "topology-directed") {
      layoutNodes = topologySort(graph);
    } else if (ordering === "degree") {
      // layout according to the descent order of degrees
      layoutNodes = graph
        .nodes()
        .sort((a, b) => graph.nodeDegree(b) - graph.nodeDegree(a))
        .map((e: string) => graph.node(e)! as Node);
    } else {
      // layout according to the original order in the data.nodes
      layoutNodes = nodes;
    }

    const divN = Math.ceil(n / divisions); // node number in each division
    for (let i = 0; i < n; ++i) {
      let r = radius;
      if (!r && startRadius !== null && endRadius !== null) {
        r = startRadius + (i * (endRadius - startRadius)) / (n - 1);
      }
      if (!r) {
        r = 10 + (i * 100) / (n - 1);
      }
      let angle =
        startAngle +
        (i % divN) * astep +
        ((2 * Math.PI) / divisions) * Math.floor(i / divN);
      if (!clockwise) {
        angle =
          endAngle -
          (i % divN) * astep -
          ((2 * Math.PI) / divisions) * Math.floor(i / divN);
      }
      layoutNodes[i].x = center[0] + Math.cos(angle) * r;
      layoutNodes[i].y = center[1] + Math.sin(angle) * r;
      layoutNodes[i].weight = graph.nodeDegree(layoutNodes[i].id);
    }

    self.onLayoutEnd?.();

    return {
      nodes: layoutNodes,
      edges: this.edges,
    };
  }

  public getType() {
    return "circular";
  }
}
