import * as d3Force from 'd3-force';
import { PointTuple, NodeSize } from '../types';
import { getNodeSize, isArray, isFunction, isNumber, isObject } from '../../util';
import { LAYOUT_MESSAGE } from '../../util/constants';
import { LayoutOption, AsyncLayout } from '../Layout';
import forceInABox from './force-in-a-box';

export type ForceLayoutOptions = {
  center?: PointTuple;
  linkDistance?: number | ((d?: any) => number) | undefined;
  edgeStrength?: number | ((d?: any) => number) | undefined;
  nodeStrength?: number | ((d?: any) => number) | undefined;
  preventOverlap?: boolean;
  collideStrength?: number;
  nodeSize?: NodeSize;
  nodeSpacing?: number | number[] | ((d?: any) => number) | undefined;
  alpha?: number;
  alphaDecay?: number;
  alphaMin?: number;
  clustering?: boolean;
  clusterNodeStrength?: number;
  clusterEdgeStrength?: number;
  clusterEdgeDistance?: number;
  clusterNodeSize?: number;
  clusterFociStrength?: number;
  forceSimulation?: any;
  tick?: () => void;
} & LayoutOption;

const defaultForceLayoutOptions: ForceLayoutOptions = {
  center: [0, 0],
  preventOverlap: false,
  linkDistance: 50,
  alphaDecay: 0.028,
  alphaMin: 0.001,
  alpha: 0.3,
  collideStrength: 1,
  clustering: false,
  clusterNodeStrength: -1,
  clusterEdgeStrength: 0.1,
  clusterEdgeDistance: 100,
  clusterFociStrength: 0.8,
  clusterNodeSize: 10,
};

/**
 * 经典力导布局 force-directed
 */
export default class ForceLayout extends AsyncLayout {
  option: ForceLayoutOptions = { ...defaultForceLayoutOptions };

  constructor(options?: ForceLayoutOptions) {
    super();
    this.updateCfg(options);
  }

  getDefaultCfg() {
    return { ...defaultForceLayoutOptions };
  }

  ticking = false;

  clusterForce: any;

  edgeForce: any;

  forceSimulation: any;

  reloadData = false;

  /**
   * 执行布局
   */
  public async execute() {
    const reloadData = this.reloadData;
    const { nodes, edges } = this.data;

    // 如果正在布局，忽略布局请求
    if (this.ticking) {
      return;
    }
    const {
      forceSimulation,
      alpha,
      alphaDecay,
      alphaMin,
      nodeStrength,
      clustering,
      center,
      clusterFociStrength,
      clusterEdgeDistance,
      clusterEdgeStrength,
      clusterNodeStrength,
      clusterNodeSize,
      preventOverlap,
      edgeStrength,
      linkDistance,
      tick,
    } = this.option;

    let simulation = forceSimulation;
    if (!simulation) {
      try {
        // 定义节点的力
        const nodeForce = d3Force.forceManyBody();
        if (nodeStrength) {
          nodeForce.strength(nodeStrength);
        }
        simulation = d3Force.forceSimulation().nodes(nodes as any);

        if (clustering) {
          const clusterForce = forceInABox() as any;
          clusterForce.centerX(center[0]).centerY(center[1]).template('force').strength(clusterFociStrength);
          if (edges) {
            clusterForce.links(edges);
          }
          if (nodes) {
            clusterForce.nodes(nodes);
          }
          clusterForce
            .forceLinkDistance(clusterEdgeDistance)
            .forceLinkStrength(clusterEdgeStrength)
            .forceCharge(clusterNodeStrength)
            .forceNodeSize(clusterNodeSize);

          this.clusterForce = clusterForce;
          simulation.force('group', clusterForce);
        }
        simulation
          .force('center', d3Force.forceCenter(center[0], center[1]))
          .force('charge', nodeForce)
          .alpha(alpha)
          .alphaDecay(alphaDecay)
          .alphaMin(alphaMin);

        if (preventOverlap) {
          this.overlapProcess(simulation);
        }
        // 如果有边，定义边的力
        if (edges) {
          // d3 的 forceLayout 会重新生成边的数据模型，为了避免污染源数据
          const edgeForce = d3Force
            .forceLink()
            .id((d: any) => d.id)
            .links(edges);
          if (edgeStrength) {
            edgeForce.strength(edgeStrength);
          }
          if (linkDistance) {
            edgeForce.distance(linkDistance);
          }
          this.edgeForce = edgeForce;
          simulation.force('link', edgeForce);
        }

        if (!isInWorker()) {
          this.ticking = true;
          const simulationPromise = new Promise<void>((resolve) => {
            simulation
              .on('tick', () => {
                if (tick) {
                  tick();
                }
              })
              .on('end', () => {
                resolve();
                this.ticking = false;
              });
          });
          await simulationPromise;
        } else {
          // worker is enabled
          simulation.stop();
          const totalTicks = getSimulationTicks(simulation);
          for (let currentTick = 1; currentTick <= totalTicks; currentTick++) {
            simulation.tick();
            // currentTick starts from 1.
            postMessage(
              {
                nodes,
                currentTick,
                totalTicks,
                type: LAYOUT_MESSAGE.TICK,
              },
              undefined as any,
            );
          }
          this.ticking = false;
        }

        this.forceSimulation = simulation;
        this.ticking = true;
      } catch (e) {
        this.ticking = false;
        console.warn(e);
      }
    } else {
      if (reloadData) {
        if (clustering && this.clusterForce) {
          this.clusterForce.nodes(nodes);
          this.clusterForce.links(edges);
        }
        simulation.nodes(nodes);
        if (edges && this.edgeForce) this.edgeForce.links(edges);
        else if (edges && !this.edgeForce) {
          // d3 的 forceLayout 会重新生成边的数据模型，为了避免污染源数据
          const edgeForce = d3Force
            .forceLink()
            .id((d: any) => d.id)
            .links(edges);
          if (edgeStrength) {
            edgeForce.strength(edgeStrength);
          }
          if (linkDistance) {
            edgeForce.distance(linkDistance);
          }
          this.edgeForce = edgeForce;
          simulation.force('link', edgeForce);
        }
      }
      if (preventOverlap) {
        this.overlapProcess(simulation);
      }
      simulation.alpha(alpha).restart();
      this.ticking = true;
    }

    return this.data;
  }

  /**
   * 防止重叠
   * @param {object} simulation 力模拟模型
   */
  public overlapProcess(simulation: any) {
    const { nodeSize, nodeSpacing, collideStrength } = this.option;
    let nodeSizeFunc: (d: any) => number;
    let nodeSpacingFunc: any;

    if (isNumber(nodeSpacing)) {
      nodeSpacingFunc = () => nodeSpacing;
    } else if (isFunction(nodeSpacing)) {
      nodeSpacingFunc = nodeSpacing;
    } else {
      nodeSpacingFunc = () => 0;
    }

    if (!nodeSize) {
      nodeSizeFunc = (d) => {
        if (d.size) {
          if (isArray(d.size)) {
            const res = d.size[0] > d.size[1] ? d.size[0] : d.size[1];
            return res / 2 + nodeSpacingFunc(d);
          }
          if (isObject(d.size)) {
            const res = d.size.width > d.size.height ? d.size.width : d.size.height;
            return res / 2 + nodeSpacingFunc(d);
          }
          return d.size / 2 + nodeSpacingFunc(d);
        }
        return 10 + nodeSpacingFunc(d);
      };
    } else {
      (node) => {
        const sizes = getNodeSize(nodeSize, node);
        let size = 10;

        if (sizes) {
          size = Math.max(...sizes) / 2;
        }

        return size + nodeSpacingFunc(node);
      };
    }

    // forceCollide's parameter is a radius
    simulation.force('collisionForce', d3Force.forceCollide(nodeSizeFunc).strength(collideStrength));
  }

  /**
   * 更新布局配置，但不执行布局
   * @param {object} cfg 需要更新的配置项
   */
  public updateOption(cfg: ForceLayoutOptions) {
    if (this.ticking) {
      this.forceSimulation.stop();
      this.ticking = false;
    }
    this.forceSimulation = null;
    super.updateOption(cfg);
  }
}

// Return total ticks of d3-force simulation
function getSimulationTicks(simulation: any): number {
  const alphaMin = simulation.alphaMin();
  const alphaTarget = simulation.alphaTarget();
  const alpha = simulation.alpha();
  const totalTicksFloat =
    Math.log((alphaMin - alphaTarget) / (alpha - alphaTarget)) / Math.log(1 - simulation.alphaDecay());
  const totalTicks = Math.ceil(totalTicksFloat);
  return totalTicks;
}
declare const WorkerGlobalScope: any;

// 判断是否运行在web worker里
function isInWorker(): boolean {
  // eslint-disable-next-line no-undef
  return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
}
