import { MDSLayout } from '../../src'
import dataset from '../data';

const data = dataset.data;


describe('#MDSLayout', () => {
  it('return correct default config', () => {
    const mds = new MDSLayout();
    expect(mds.getDefaultCfg()).toEqual({
      center: [0, 0],
      linkDistance: 50,
    });
    mds.layout(data);
    expect((data.nodes[0] as any).x).not.toBe(undefined);
    expect((data.nodes[0] as any).y).not.toBe(undefined);
  });

  it('mds with fixed link length', () => {
    const mds = new MDSLayout({
      center: [250, 250],
      linkDistance: 120,
    });
    mds.layout(data);
    expect(data.nodes[0].x != null).toEqual(true);
  });

  it('mds layout with no node', () => {
    const mds = new MDSLayout({
      center: [250, 250],
      linkDistance: 120,
    });
    mds.layout({
      nodes: [],
    });
  });

  it('mds layout with one node', () => {
    const data1: any = {
      nodes: [
        {
          id: 'node',
        },
      ],
    };
    const mds = new MDSLayout({
      center: [250, 250],
      linkDistance: 120,
    });
    mds.layout(data1)
    const nodeModel = data1.nodes[0];
    expect(nodeModel.x).toEqual(250);
    expect(nodeModel.y).toEqual(250);
  });
  it('mds layout with unconnected graph', () => {
    const mds = new MDSLayout({
      center: [250, 250],
      linkDistance: 120,
    });
    mds.layout({
      nodes: [
        {
          id: 'node0',
        },
        {
          id: 'node1',
        },
        {
          id: 'node2',
        },
      ],
      edges: [
        {
          source: 'node0',
          target: 'node1',
        },
      ],
    })
    // const nodeModel = graph.getNodes()[0].getModel();
    // expect(nodeModel.x).toEqual(250);
    // expect(nodeModel.y).toEqual(250);
    // graph.destroy();
  });
})