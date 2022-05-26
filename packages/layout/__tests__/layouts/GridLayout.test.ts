import GridLayout from '../../src/layouts/GridLayout';
import { getRandomNodes } from '../data/func';

describe('Grid Layout Tests', () => {
  it('layout begin correctly', () => {
    const nodes = [1, 2, 3, 4].map((e) => ({ id: `${e}`, x: 0, y: 0, e }));
    const layout = new GridLayout({
      begin: [10, 10],
      sortBy: 'e',
    });
    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    // node will be in [[1,2],[3,4]] and same gap
    expect(layoutNodes[0].y).toBe(layoutNodes[1].y);
    expect(layoutNodes[0].x).toBe(layoutNodes[2].x);
  });

  it("not throw error when there's no nodes", () => {
    const layout = new GridLayout();
    const data = {};
    expect(() => layout.layout(data)).not.toThrow();
  });

  it("layout node to begin when there's only one node", () => {
    const nodes = [{ id: '1', x: 0, y: 0 }];
    const layout = new GridLayout({
      begin: [10, 10],
    });
    const data = {
      nodes: nodes,
      edges: [],
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].x).toBe(10);
    expect(layoutNodes[0].y).toBe(10);
  });

  it('sort by degree', () => {
    const nodes = [
      { id: '1', x: 0, y: 0 },
      { id: '2', x: 0, y: 0 },
      { id: '3', x: 0, y: 0 },
      { id: '4', x: 0, y: 0 },
    ];
    const layout = new GridLayout({
      begin: [10, 10],
      sortBy: 'degree',
    });
    const data = {
      nodes: nodes,
      edges: [
        { source: '1', target: '2' },
        { source: '1', target: '3' },
        { source: '2', target: '3' },
      ],
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].x).toBeLessThan(layoutNodes[3].x);
    expect(layoutNodes[0].y).toBeLessThan(layoutNodes[3].y);
  });

  it('default sort by degree', () => {
    const nodes = [
      { id: '1', x: 0, y: 0 },
      { id: '2', x: 0, y: 0 },
      { id: '3', x: 0, y: 0 },
      { id: '4', x: 0, y: 0 },
      { id: '5', x: 0, y: 0 },
    ];
    const layout = new GridLayout({
      begin: [10, 10],
    });
    const data = {
      nodes: nodes,
      edges: [
        { source: '1', target: '2' },
        { source: '1', target: '3' },
        { source: '2', target: '3' },
      ],
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].x).toBeLessThan(layoutNodes[3].x);
    expect(layoutNodes[0].y).toBeLessThan(layoutNodes[3].y);
  });

  it('layout node on single col', () => {
    const nodes = [
      { id: '1', x: 0, y: 0 },
      { id: '2', x: 0, y: 0 },
      { id: '3', x: 0, y: 0 },
      { id: '4', x: 0, y: 0 },
    ];
    const layout = new GridLayout({
      begin: [10, 10],
      cols: 1,
    });

    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    const xs = layoutNodes.map((e) => e.x);

    expect(xs.every((x) => x === xs[0])).toBeTruthy();
  });

  it('layout node on single row', () => {
    const nodes = [
      { id: '1', x: 0, y: 0 },
      { id: '2', x: 0, y: 0 },
      { id: '3', x: 0, y: 0 },
      { id: '4', x: 0, y: 0 },
    ];
    const layout = new GridLayout({
      begin: [10, 10],
      rows: 1,
    });

    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    const ys = layoutNodes.map((e) => e.y);

    expect(ys.every((y) => y === ys[0])).toBeTruthy();
  });

  it('optimize grid when nodes are more than cells', () => {
    const nodes = [
      { id: '1', x: 0, y: 0 },
      { id: '2', x: 0, y: 0 },
      { id: '3', x: 0, y: 0 },
      { id: '4', x: 0, y: 0 },
      { id: '5', x: 0, y: 0 },
    ];
    const layout = new GridLayout({
      begin: [10, 10],
      rows: 1,
      cols: 1,
      optimizeGrid: true,
    });

    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;

    // every nodes' position should be the different
    expect(layoutNodes.slice(1).every((e) => e.x !== layoutNodes[0].x || e.y !== layoutNodes[0].y)).toBeTruthy();
  });

  it('optimize grid when nodes are more than cells (row larger)', () => {
    const nodes = [
      { id: '1', x: 0, y: 0 },
      { id: '2', x: 0, y: 0 },
      { id: '3', x: 0, y: 0 },
      { id: '4', x: 0, y: 0 },
      { id: '5', x: 0, y: 0 },
    ];
    const layout = new GridLayout({
      begin: [10, 10],
      rows: 3,
      cols: 1,
      optimizeGrid: true,
    });

    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;

    // every nodes' position should be the different
    expect(layoutNodes.slice(1).every((e) => e.x !== layoutNodes[0].x || e.y !== layoutNodes[0].y)).toBeTruthy();
  });

  it('optimize grid when nodes are less than cells', () => {
    const nodes = [
      { id: '1', x: 0, y: 0 },
      { id: '2', x: 0, y: 0 },
      { id: '3', x: 0, y: 0 },
    ];
    const layout = new GridLayout({
      begin: [10, 10],
      rows: 12,
      cols: 14,
      optimizeGrid: true,
      nodeSize: [10, 10],
    })
    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;

    expect(layoutNodes[0].x - layoutNodes[2].x).toBeLessThan(50);
  });

  it('set node to position', () => {
    const nodes = [
      { id: '1', x: 0, y: 0 },
      { id: '2', x: 0, y: 0 },
      { id: '3', x: 0, y: 0 },
      { id: '4', x: 0, y: 0 },
    ];
    const layout = new GridLayout({
      begin: [10, 10],
      position: (n) => {
        if (n.id === '4') {
          return {row: 0, col: 0};
        }
        return null;
      }
    });

    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].x).toEqual(layoutNodes[3].x);
    expect(layoutNodes[0].y).toEqual(layoutNodes[3].y);
  })

  // 4 nodes random size

  const nodes = getRandomNodes(4).map(e => ({
    ...e,
    size: [Math.random() * 100, Math.random() * 100]
  }))
  

  it('row align top correctly', () => {
    const layout = new GridLayout({
      nodeSize: (n) => n.size,
      rowAlign: 'top',
      cols: 2,
      rows: 2
    });

    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].y - layoutNodes[0].size[1] / 2).toBeCloseTo(layoutNodes[1].y - layoutNodes[1].size[1] / 2);
  });

  it('row align bottom correctly', () => {
    const layout = new GridLayout({
      nodeSize: (n) => n.size,
      rowAlign: 'bottom',
      cols: 2,
      rows: 2
    });
    
    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].y + layoutNodes[0].size[1] / 2).toBeCloseTo(layoutNodes[1].y + layoutNodes[1].size[1] / 2);
  });

  it('row align center correctly', () => {
    const layout = new GridLayout({
      nodeSize: (n) => n.size,
      rowAlign: 'center',
      cols: 2,
      rows: 2
    });

    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].y).toBeCloseTo(layoutNodes[1].y);
  });

  it('col align left correctly', () => {
    const layout = new GridLayout({
      nodeSize: (n) => n.size,
      colAlign: 'left',
      cols: 2,
      rows: 2
    });

    const data = {
      nodes: nodes,
    };
    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].x - layoutNodes[0].size[0] / 2).toBeCloseTo(layoutNodes[2].x - layoutNodes[2].size[0] / 2);
  });

  it('col align right correctly', () => {
    const layout = new GridLayout({
      nodeSize: (n) => n.size,
      colAlign: 'right',
      cols: 2,
      rows: 2
    });

    const data = {
      nodes: nodes,
    };

    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].x + layoutNodes[0].size[0] / 2).toBeCloseTo(layoutNodes[2].x + layoutNodes[2].size[0] / 2);
  });

  it('col align center correctly', () => {
    const layout = new GridLayout({
      nodeSize: (n) => n.size,
      colAlign: 'center',
      cols: 2,
      rows: 2
    });

    const data = {
      nodes: nodes,
    };

    layout.layout(data);
    const { nodes: layoutNodes } = data;
    expect(layoutNodes[0].x).toBeCloseTo(layoutNodes[2].x);
  }
  );

});
