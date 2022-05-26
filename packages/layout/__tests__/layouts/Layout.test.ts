import Layout from "../../src/layouts/Layout";

describe('Basic Layout test', () => {
  it('update option correctly', () => {
    const onLayoutEnd = () => {};
    const layout = new Layout({});
    layout.updateCfg({ onLayoutEnd });
    expect(layout.getOption().onLayoutEnd).toBe(onLayoutEnd);
  })

  it('on layout end should be called', async () => {
    const onLayoutEnd = jest.fn();
    const layout = new Layout({ onLayoutEnd });
    await layout.layout({});
    expect(onLayoutEnd).toBeCalled();
  });
})