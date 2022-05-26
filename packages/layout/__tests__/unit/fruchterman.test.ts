import { GridLayout, FruchtermanLayout } from '../../src'
import dataset from '../data';
const data = dataset.data;


describe('#FruchtermanLayout', () => {
  const preGrid = new GridLayout({
    width: 500,
    height: 500
  });
  preGrid.layout(data);

  it('return correct default config', () => {
    const fruchterman = new FruchtermanLayout();
    expect(fruchterman.getDefaultCfg()).toEqual({
      animate: true,
      maxIteration: 1000,
      gravity: 10,
      speed: 1,
      clustering: false,
      clusterGravity: 10,
    });
    fruchterman.layout(data);
    expect((data.nodes[0] as any).x).not.toBe(undefined);
    expect((data.nodes[0] as any).y).not.toBe(undefined);
  });
  it('new graph with fruchterman layout, with configurations', () => {
    const fruchterman = new FruchtermanLayout({
      center: [100, 100],
      maxIteration: 5000
    });
    fruchterman.layout(data);

    expect(data.nodes[0].x).not.toEqual(undefined);
    expect(data.nodes[0].y).not.toEqual(undefined);
    expect(data.nodes[1].x).not.toEqual(undefined);
    expect(data.nodes[1].y).not.toEqual(undefined);
  });
  it('fruchterman layout with no node', () => {
    const fruchterman = new FruchtermanLayout({
      center: [100, 100],
      maxIteration: 5000
    });
    fruchterman.layout({
      nodes: []
    });
  });
  it('fruchterman layout with one node', () => {
    const fruchterman = new FruchtermanLayout({
      width: 500,
      height: 500
    });
    const data1 = {
      nodes: [
        {
          id: 'node',
        }
      ]
    }
    fruchterman.layout(data1);
    const nodeModel: any = data1.nodes[0];
    expect(nodeModel.x).toEqual(250);
    expect(nodeModel.y).toEqual(250);
  });
  it('fruchterman layout with clustering and no clusterGravity', () => {
    const colors = ['#f00', '#0f0', '#00f', '#ff0'];
    data.nodes.forEach((node) => {
      node.size = 10;
      node.cluster = Math.ceil((Math.random() / 3) * 10);
      node.style = {
        fill: colors[node.cluster],
      };
    });

    const fruchterman = new FruchtermanLayout({
      clustering: true,
      maxIteration: 3000,
      clusterGravity: null,
    });
    fruchterman.layout(data);
    
    const node0 = data.nodes[0];
    expect(node0.x).not.toEqual(NaN);
    expect(node0.y).not.toEqual(NaN);
  });
  it('fruchterman layout with overlapped nodes and loop edge', async () => {
    const fruchterman = new FruchtermanLayout({
      clustering: true,
      maxIteration: 5000,
      clusterGravity: null,
    });
    const tmpData = {
      nodes: [
        {
          id: 'node0',
          x: 100,
          y: 100,
        },
        {
          id: 'node1',
          x: 100,
          y: 100,
        },
        {
          id: 'node3',
          x: 150,
          y: 120,
        },
      ],
      edges: [
        {
          source: 'node3',
          target: 'node3',
        },
      ],
    };
    fruchterman.layout(tmpData);
    await new Promise((r) => setTimeout(r, 2000));
    const node0 = tmpData.nodes[0];
    const node1 = tmpData.nodes[1];
    expect(node0.x).not.toEqual(node1.x);
    expect(node0.y).not.toEqual(node1.y);
  });
  it('update fructherman layout configurations', () => {
    const fruchterman = new FruchtermanLayout();
    fruchterman.layout(data);
    
    fruchterman.updateCfg({
      center: [100, 100],
      gravity: 50,
    });
    expect(data.nodes[0].x).not.toEqual(undefined);
    expect(data.nodes[0].y).not.toEqual(undefined);
    expect(data.nodes[1].x).not.toEqual(undefined);
    expect(data.nodes[1].y).not.toEqual(undefined);
  });
})