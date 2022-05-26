import { PointTuple } from 'layouts/types';
import {  Layout, LayoutOption } from './Layout';

export type RandomLayoutOption = {
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
   * @description center of the position range
   * @description.zh-CN 布局的中心
   */
  center?: PointTuple;
  /**
   * @description scale the position range
   * @description.zh-CN 布局的缩放
   */
  layoutScale?: number;
} & LayoutOption;

export const defaultRandomLayoutOption = {
  width: 300,
  height: 300,
  center: [0, 0],
  layoutScale: 0.9,
} as RandomLayoutOption;

export default class RandomLayout extends Layout {
  option: RandomLayoutOption = { ...defaultRandomLayoutOption };

  getDefaultOption() {
    return { ...defaultRandomLayoutOption };
  }

  public execute() {
    const { nodes = [] } = this.data;
    const { width: originWidth, height: originHeight, center, layoutScale } = this.option;
    const [width, height] = [originWidth * layoutScale, originHeight * layoutScale];
    const xBase = center[0] - width / 2;
    const yBase = center[1] - height / 2;

    nodes.forEach((node) => {
      node.x = xBase + Math.random() * width;
      node.y = yBase + Math.random() * height;
    });

    return this.data;
  }
}
