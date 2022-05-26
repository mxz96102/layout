import { ConcentricLayout } from '../../src'
import { mathEqual } from '../util';
import dataset from '../data';
const data = dataset.data;

describe('#ConcentricLayout', () => {
  it('return correct default config', () => {
    const concentric = new ConcentricLayout();
    expect(concentric.getDefaultCfg()).toEqual({
      nodeSize: 30,
      minNodeSpacing: 10,
      preventOverlap: false,
      sweep: undefined,
      equidistant: false,
      startAngle: (3 / 2) * Math.PI,
      clockwise: true,
      maxLevelDiff: undefined,
      sortBy: 'degree',
      nodeSpacing: 10,
    });
    concentric.layout(data);
    expect((data.nodes[0] as any).x).not.toBe(undefined);
    expect((data.nodes[0] as any).y).not.toBe(undefined);
  });
  it('concentric with no node', () => {
    const concentric = new ConcentricLayout();
    concentric.layout({nodes:[]})
  });

  it('concentric with one node', () => {
    const concentric = new ConcentricLayout({
      center: [150, 50]
    });
    const data1 = {
      nodes: [
        {
          id: 'node',
          x: 100,
          y: 100,
        },
      ],
    };
    concentric.layout(data1)
    expect(data1.nodes[0].x).toEqual(150);
    expect(data1.nodes[0].y).toEqual(50);
  });

  it('concentric with array nodeSize', () => {
    const width = 500;
    const height = 500;
    const concentric = new ConcentricLayout({
      nodeSize: [10, 20],
      width,
      height
    });
    concentric.layout(data)
    const node = data.nodes[2];
    expect(mathEqual(node.x, width / 2)).toEqual(true);
    expect(mathEqual(node.y, height / 2)).toEqual(true);
  });

  it('concentric with array size in node data, sortBy in data undefined', () => {
    const width = 500;
    const height = 500;
    data.nodes.forEach((node) => {
      node.size = [10, 20];
      node.labelCfg = {
        style: {
          fontSize: 5
        }
      }
    });
    const concentric = new ConcentricLayout({
      sortBy: 'ttt',
      width,
      height
    });
    concentric.layout(data)
    const node = data.nodes[2];
    expect(mathEqual(node.x, width / 2)).toEqual(true);
    expect(mathEqual(node.y, height / 2)).toEqual(true);
  });

  it('concentric preventOverlap', () => {
    const width = 500;
    const height = 500;
    const concentric = new ConcentricLayout({
      width,
      height,
      preventOverlap: true,
    });
    concentric.layout(data)
    const node = data.nodes[2];
    expect(mathEqual(node.x, width / 2)).toEqual(true);
    expect(mathEqual(node.y, height / 2)).not.toEqual(true);
  });

  it('concentric equidistant', () => {
    const width = 500;
    const height = 500;
    const concentric = new ConcentricLayout({
      width,
      height,
      equidistant: true,
    });
    concentric.layout(data)
    const node = data.nodes[2];
    expect(mathEqual(node.x, width / 2)).toEqual(true);
    expect(mathEqual(node.y, height / 2)).toEqual(true);
  });

  it('instantiate layout', () => {
    const concentric = new ConcentricLayout({
      center: [250, 250],
      sweep: 1
    });
    concentric.layout(data)

    expect(data.nodes[0].x).not.toEqual(undefined);
    expect(data.nodes[0].y).not.toEqual(undefined);
    expect(data.nodes[1].x).not.toEqual(undefined);
    expect(data.nodes[1].y).not.toEqual(undefined);
  });
})