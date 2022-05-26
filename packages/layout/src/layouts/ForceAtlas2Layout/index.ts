/**
 * @fileOverview force atlas 2
 * @author shiwu.wyy@antfin.com
 */
import { PointTuple, NodeSize } from '../types';
import { getEdgeTerminal, getNodeSize } from '../../util';
import { Layout } from '../Layout';
import Body from './body';
import Quad from './quad';
import QuadTree from './quadTree';

export type ForceAtlas2LayoutOptions = {
  center?: PointTuple;
  width?: number;
  height?: number;
  workerEnabled?: boolean;
  onLayoutEnd?: () => void;
  tick?: () => void;
  kr?: number;
  kg?: number;
  ks?: number;
  ksmax?: number;
  tao?: number;
  maxIteration?: number;
  mode?: 'normal' | 'linlog';
  preventOverlap?: boolean;
  dissuadeHubs?: boolean;
  barnesHut?: boolean;
  prune?: boolean;
  nodeSize?: NodeSize
};

export default class ForceAtlas2Layout extends Layout {
  option: ForceAtlas2LayoutOptions = {
    width: 300,
    height: 300,
    center: [150, 150],
    kr: 5,
    kg: 1,
    mode: 'normal',
    preventOverlap: false,
    dissuadeHubs: false,
    barnesHut: false,
    maxIteration: 0,
    ks: 0.1,
    ksmax: 10,
    tao: 0.1,
  };

  constructor(options?: ForceAtlas2LayoutOptions) {
    super();
    this.updateCfg(options);
  }

  public getDefaultCfg() {
    return {};
  }

  // execute the layout
  public execute() {
    const { nodes } = this.data;
    const { nodeSize } = this.option;
    let { maxIteration } = this.option;

    // the whidth of each nodes
    const sizes = [];
    const nodeNum = nodes.length;
    for (let i = 0; i < nodeNum; i += 1) {
      const node = nodes[i];
      const size = getNodeSize(nodeSize, node);
      const maxSize = Math.max(size[0], size[1]);
      sizes.push(maxSize);
    }

    if (this.option.barnesHut === undefined && nodeNum > 250) this.option.barnesHut = true;
    if (this.option.prune === undefined && nodeNum > 100) this.option.prune = true;
    if (this.option.maxIteration === 0 && !this.option.prune) {
      maxIteration = 250;
      if (nodeNum <= 200 && nodeNum > 100) maxIteration = 1000;
      else if (nodeNum > 200) maxIteration = 1200;
      this.option.maxIteration = maxIteration;
    } else if (this.option.maxIteration === 0 && this.option.prune) {
      maxIteration = 100;
      if (nodeNum <= 200 && nodeNum > 100) maxIteration = 500;
      else if (nodeNum > 200) maxIteration = 950;
      this.option.maxIteration = maxIteration;
    }

    if (!this.option.kr) {
      this.option.kr = 50;
      if (nodeNum > 100 && nodeNum <= 500) this.option.kr = 20;
      else if (nodeNum > 500) this.option.kr = 1;
    }
    if (!this.option.kg) {
      this.option.kg = 20;
      if (nodeNum > 100 && nodeNum <= 500) this.option.kg = 10;
      else if (nodeNum > 500) this.option.kg = 1;
    }
    this.data.nodes = this.updateNodesByForces(sizes);
    return this.data;
  }

  updateNodesByForces(sizes: number[]) {
    const { maxIteration } = this.option;
    const { edges } = this.data;
    let { nodes } = this.data;

    const nonLoopEdges = edges.filter((edge: any) => {
      const source = getEdgeTerminal(edge, 'source');
      const target = getEdgeTerminal(edge, 'target');
      return source !== target;
    });
    const size = nodes.length;
    const esize = nonLoopEdges.length;

    const degrees = [];
    const idMap: { [key: string]: number } = {};
    const edgeEndsIdMap: { [key: number]: { sourceIdx: number; targetIdx: number } } = {};

    // tslint:disable-next-line
    const Es = [];
    for (let i = 0; i < size; i += 1) {
      idMap[nodes[i].id] = i;
      degrees[i] = 0;
      if (nodes[i].x === undefined || isNaN(nodes[i].x)) {
        nodes[i].x = Math.random() * 1000;
      }
      if (nodes[i].y === undefined || isNaN(nodes[i].y)) {
        nodes[i].y = Math.random() * 1000;
      }
      Es.push({ x: nodes[i].x, y: nodes[i].y });
    }
    for (let i = 0; i < esize; i += 1) {
      let node1;
      let node2;
      let sIdx = 0;
      let tIdx = 0;

      for (let j = 0; j < size; j += 1) {
        const source = getEdgeTerminal(nonLoopEdges[i], 'source');
        const target = getEdgeTerminal(nonLoopEdges[i], 'target');
        if (nodes[j].id === source) {
          node1 = nodes[j];
          sIdx = j;
        } else if (nodes[j].id === target) {
          node2 = nodes[j];
          tIdx = j;
        }
        edgeEndsIdMap[i] = { sourceIdx: sIdx, targetIdx: tIdx };
      }
      if (node1) degrees[idMap[node1.id]] += 1;
      if (node2) degrees[idMap[node2.id]] += 1;
    }

    let iteration = maxIteration;
    nodes = this.iterate(iteration, idMap, edgeEndsIdMap, esize, degrees, sizes);

    // if prune, place the leaves around their parents, and then re-layout for several iterations.
    if (this.option.prune) {
      for (let j = 0; j < esize; j += 1) {
        if (degrees[edgeEndsIdMap[j].sourceIdx] <= 1) {
          nodes[edgeEndsIdMap[j].sourceIdx].x = nodes[edgeEndsIdMap[j].targetIdx].x;
          nodes[edgeEndsIdMap[j].sourceIdx].y = nodes[edgeEndsIdMap[j].targetIdx].y;
        } else if (degrees[edgeEndsIdMap[j].targetIdx] <= 1) {
          nodes[edgeEndsIdMap[j].targetIdx].x = nodes[edgeEndsIdMap[j].sourceIdx].x;
          nodes[edgeEndsIdMap[j].targetIdx].y = nodes[edgeEndsIdMap[j].sourceIdx].y;
        }
      }
      this.option.prune = false;
      this.option.barnesHut = false;
      iteration = 100;
      nodes = this.iterate(iteration, idMap, edgeEndsIdMap, esize, degrees, sizes);
    }
    return nodes;
  }

  iterate(
    iteration: number,
    idMap: { [key: string]: number },
    edgeEndsIdMap: { [key: number]: { sourceIdx: number; targetIdx: number } },
    esize: number,
    degrees: number[],
    sizes: number[],
  ) {
    let { nodes } = this.data;
    const { kr, preventOverlap, barnesHut, tick } = this.option;

    const nodeNum = nodes.length;
    let sg = 0;
    const krPrime = 100;
    let iter = iteration;
    const prevoIter = 50;
    let forces = [];
    const preForces = [];
    const bodies = [];

    for (let i = 0; i < nodeNum; i += 1) {
      forces[2 * i] = 0;
      forces[2 * i + 1] = 0;

      if (barnesHut) {
        const params = {
          id: i,
          rx: nodes[i].x,
          ry: nodes[i].y,
          mass: 1,
          g: kr,
          degree: degrees[i],
        };
        bodies[i] = new Body(params);
      }
    }

    while (iter > 0) {
      for (let i = 0; i < nodeNum; i += 1) {
        preForces[2 * i] = forces[2 * i];
        preForces[2 * i + 1] = forces[2 * i + 1];
        forces[2 * i] = 0;
        forces[2 * i + 1] = 0;
      }
      // attractive forces, existing on every actual edge
      forces = this.getAttrForces(iter, prevoIter, esize, idMap, edgeEndsIdMap, degrees, sizes, forces);

      // repulsive forces and Gravity, existing on every node pair
      // if preventOverlap, using the no-optimized method in the last prevoIter instead.
      if (barnesHut && ((preventOverlap && iter > prevoIter) || !preventOverlap)) {
        forces = this.getOptRepGraForces(forces, bodies, degrees);
      } else {
        forces = this.getRepGraForces(iter, prevoIter, forces, krPrime, sizes, degrees);
      }
      // update the positions
      const res = this.updatePos(forces, preForces, sg, degrees);
      nodes = res.nodes;
      sg = res.sg;
      iter--;
      if (tick) {
        tick();
      }
    }

    return nodes;
  }

  getAttrForces(
    iter: number,
    prevoIter: number,
    esize: number,
    idMap: { [key: string]: number },
    edgeEndsIdMap: { [key: number]: { sourceIdx: number; targetIdx: number } },
    degrees: number[],
    sizes: number[],
    forces: number[],
  ): number[] {
    const { preventOverlap, dissuadeHubs, mode, prune } = this.option;
    const { nodes } = this.data;
    for (let i = 0; i < esize; i += 1) {
      const sourceNode = nodes[edgeEndsIdMap[i].sourceIdx];
      const sourceIdx = edgeEndsIdMap[i].sourceIdx;
      const targetNode = nodes[edgeEndsIdMap[i].targetIdx];
      const targetIdx = edgeEndsIdMap[i].targetIdx;

      if (prune && (degrees[sourceIdx] <= 1 || degrees[targetIdx] <= 1)) continue;

      const dir = [targetNode.x - sourceNode.x, targetNode.y - sourceNode.y];
      let eucliDis = Math.hypot(dir[0], dir[1]);
      eucliDis = eucliDis < 0.0001 ? 0.0001 : eucliDis;
      dir[0] = dir[0] / eucliDis;
      dir[1] = dir[1] / eucliDis;

      if (preventOverlap && iter < prevoIter) eucliDis = eucliDis - sizes[sourceIdx] - sizes[targetIdx];
      let Fa1 = eucliDis; 
      let Fa2 = Fa1; 
      if (mode === 'linlog') {
        Fa1 = Math.log(1 + eucliDis);
        Fa2 = Fa1;
      }
      if (dissuadeHubs) {
        Fa1 = eucliDis / degrees[sourceIdx];
        Fa2 = eucliDis / degrees[targetIdx];
      }
      if (preventOverlap && iter < prevoIter && eucliDis <= 0) {
        Fa1 = 0;
        Fa2 = 0;
      } else if (preventOverlap && iter < prevoIter && eucliDis > 0) {
        Fa1 = eucliDis;
        Fa2 = eucliDis;
      }
      forces[2 * idMap[sourceNode.id]] += Fa1 * dir[0];
      forces[2 * idMap[targetNode.id]] -= Fa2 * dir[0];
      forces[2 * idMap[sourceNode.id] + 1] += Fa1 * dir[1];
      forces[2 * idMap[targetNode.id] + 1] -= Fa2 * dir[1];
    }
    return forces;
  }
  getRepGraForces(
    iter: number,
    prevoIter: number,
    forces: number[],
    krPrime: number,
    sizes: number[],
    degrees: number[],
  ) {
    const { preventOverlap, kr, kg, center, prune } = this.option;
    const { nodes } = this.data;
    const nodeNum = nodes.length;
    for (let i = 0; i < nodeNum; i += 1) {
      for (let j = i + 1; j < nodeNum; j += 1) {
        if (prune && (degrees[i] <= 1 || degrees[j] <= 1)) continue;

        const dir = [nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y];
        let eucliDis = Math.hypot(dir[0], dir[1]);
        eucliDis = eucliDis < 0.0001 ? 0.0001 : eucliDis;
        dir[0] = dir[0] / eucliDis;
        dir[1] = dir[1] / eucliDis;

        if (preventOverlap && iter < prevoIter) eucliDis = eucliDis - sizes[i] - sizes[j];

        let Fr = (kr * (degrees[i] + 1) * (degrees[j] + 1)) / eucliDis; // tslint:disable-line

        if (preventOverlap && iter < prevoIter && eucliDis < 0) {
          Fr = krPrime * (degrees[i] + 1) * (degrees[j] + 1);
        } else if (preventOverlap && iter < prevoIter && eucliDis === 0) {
          Fr = 0;
        } else if (preventOverlap && iter < prevoIter && eucliDis > 0) {
          Fr = (kr * (degrees[i] + 1) * (degrees[j] + 1)) / eucliDis;
        }
        forces[2 * i] -= Fr * dir[0];
        forces[2 * j] += Fr * dir[0];
        forces[2 * i + 1] -= Fr * dir[1];
        forces[2 * j + 1] += Fr * dir[1];
      }

      // gravity
      const dir = [nodes[i].x - center[0], nodes[i].y - center[1]];
      const eucliDis = Math.hypot(dir[0], dir[1]);
      dir[0] = dir[0] / eucliDis;
      dir[1] = dir[1] / eucliDis;
      const Fg = kg * (degrees[i] + 1); // tslint:disable-line
      forces[2 * i] -= Fg * dir[0];
      forces[2 * i + 1] -= Fg * dir[1];
    }
    return forces;
  }

  getOptRepGraForces(forces: number[], bodies: any, degrees: number[]) {
    const {kg, center, prune } = this.option;
    const {nodes} = this.data;
    const nodeNum = nodes.length;
    let minx = 9e10;
    let maxx = -9e10;
    let miny = 9e10;
    let maxy = -9e10;
    for (let i = 0; i < nodeNum; i += 1) {
      if (prune && degrees[i] <= 1) continue;
      bodies[i].setPos(nodes[i].x, nodes[i].y);
      if (nodes[i].x >= maxx) maxx = nodes[i].x;
      if (nodes[i].x <= minx) minx = nodes[i].x;
      if (nodes[i].y >= maxy) maxy = nodes[i].y;
      if (nodes[i].y <= miny) miny = nodes[i].y;
    }

    const width = Math.max(maxx - minx, maxy - miny);

    const quadParams = {
      xmid: (maxx + minx) / 2,
      ymid: (maxy + miny) / 2,
      length: width,
      massCenter: center,
      mass: nodeNum,
    };
    const quad = new Quad(quadParams);
    const quadTree = new QuadTree(quad);

    // build the tree, insert the nodes(quads) into the tree
    for (let i = 0; i < nodeNum; i += 1) {
      if (prune && degrees[i] <= 1) continue;

      if (bodies[i].in(quad)) quadTree.insert(bodies[i]);
    }
    // update the repulsive forces and the gravity.
    for (let i = 0; i < nodeNum; i += 1) {
      if (prune && degrees[i] <= 1) continue;

      bodies[i].resetForce();
      quadTree.updateForce(bodies[i]);
      forces[2 * i] -= bodies[i].fx;
      forces[2 * i + 1] -= bodies[i].fy;

      // gravity
      const dir = [nodes[i].x - center[0], nodes[i].y - center[1]];
      let eucliDis = Math.hypot(dir[0], dir[1]);
      eucliDis = eucliDis < 0.0001 ? 0.0001 : eucliDis;
      dir[0] = dir[0] / eucliDis;
      dir[1] = dir[1] / eucliDis;
      const Fg = kg * (degrees[i] + 1); // tslint:disable-line
      forces[2 * i] -= Fg * dir[0];
      forces[2 * i + 1] -= Fg * dir[1];
    }
    return forces;
  }

  updatePos(forces: number[], preForces: number[], sg: number, degrees: number[]): { nodes: any; sg: number } {
    const { ks, tao, prune, ksmax } = this.option;
    const { nodes } = this.data;
    const nodeNum = nodes.length;
    const swgns = [];
    const trans = [];
    // swg(G) and tra(G)
    let swgG = 0;
    let traG = 0;
    for (let i = 0; i < nodeNum; i += 1) {
      if (prune && degrees[i] <= 1) continue;

      const minus = [forces[2 * i] - preForces[2 * i], forces[2 * i + 1] - preForces[2 * i + 1]];
      const minusNorm = Math.hypot(minus[0], minus[1]);
      const add = [forces[2 * i] + preForces[2 * i], forces[2 * i + 1] + preForces[2 * i + 1]];
      const addNorm = Math.hypot(add[0], add[1]);

      swgns[i] = minusNorm;
      trans[i] = addNorm / 2;

      swgG += (degrees[i] + 1) * swgns[i];
      traG += (degrees[i] + 1) * trans[i];
    }

    const preSG = sg;
    sg = (tao * traG) / swgG; // tslint:disable-line
    if (preSG !== 0) {
      sg = sg > 1.5 * preSG ? 1.5 * preSG : sg; // tslint:disable-line
    }
    // update the node positions
    for (let i = 0; i < nodeNum; i += 1) {
      if (prune && degrees[i] <= 1) continue;

      let sn = (ks * sg) / (1 + sg * Math.sqrt(swgns[i]));
      let absForce = Math.hypot(forces[2 * i], forces[2 * i + 1]);
      absForce = absForce < 0.0001 ? 0.0001 : absForce;
      const max = ksmax / absForce;
      sn = sn > max ? max : sn;
      const dnx = sn * forces[2 * i];
      const dny = sn * forces[2 * i + 1];
      nodes[i].x += dnx;
      nodes[i].y += dny;
    }
    return { nodes, sg };
  }
}
