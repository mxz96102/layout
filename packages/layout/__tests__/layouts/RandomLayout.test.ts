import RandomLayout from '../../src/layouts/RandomLayout';
import { getRandomNodes } from '../data/func';

describe('Random Layout Tests', () => {
  it('after layout every nodes should have different x and y', () => {
    const randomLayout = new RandomLayout();
    const data = {
      nodes: getRandomNodes()
    }
    randomLayout.layout(data);
    const nodes = data.nodes;
    const xs = nodes.map(node => node.x);
    const ys = nodes.map(node => node.y);
    expect(xs.slice(1).every(x => x !== xs[0])).toBeTruthy();
    expect(ys.slice(1).every(y => y !== ys[0])).toBeTruthy();
  });

  it('layout should not throw error when there\'s no nodes', () => {
    const randomLayout = new RandomLayout();
    const data = {};
    expect(() => randomLayout.layout(data)).not.toThrow();
  })
})
