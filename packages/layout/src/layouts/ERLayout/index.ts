/**
 * @fileOverview Force Layout Grid Align layout
 * @author wenyanqi
 */

import { AsyncLayout, LayoutOption } from "../Layout";
import layout from './core';
import { INode } from './type';

export type ERLayoutOptions = {
  width?: number;
  height?: number;
  nodeMinGap?: number;
} & LayoutOption;

export default class ERLayout extends AsyncLayout {

  option: ERLayoutOptions = {
    width: 300,
    height: 300,
    nodeMinGap: 50,
  }


  constructor(options?: any) {
    super();
    if (options) {
      this.updateCfg(options);
    }
  }

  public getDefaultCfg() {
    return {
      width: 300,
      height: 300,
      nodeMinGap: 50,
    };
  }

  /**
   * 执行布局
   */
  public async execute() {
    const { nodes = [], edges = [] } = this.data;
    // 节点初始化，size初始化
    nodes?.forEach((node: INode) => {
      if (!node.size) {
        node.size = [50, 50];
      }
    });
    await layout({
      nodes, edges,
    }, this.option);
    return this.data;
  }
}
