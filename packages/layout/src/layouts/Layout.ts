import { Model } from './types';

export type LayoutOption = {
  /**
   * @description callback function when layout end
   * @description.zh-CN 布局结束后的回调函数
   */
  onLayoutEnd?: () => void;
};

export const defaultOption = {};

/**
 * @description Base class for all layouts
 * @description-zh-CN 基础布局类
 */
export class BaseLayout<DataModel = Model> {
  /**
   * @description Layout Option for Layout
   * @description.zh-CN 布局的配置
   */
  option: LayoutOption = { ...defaultOption };

  /**
   * @description Update Layout Option
   * @description.zh-CN 更新布局的配置
   */
  public updateOption(option: LayoutOption) {
    this.option = { ...this.option, ...option };
  }

  /**
   * @description Update Layout Option (adaption for old version)
   * @description.zh-CN 更新布局的配置（兼容旧版本）
   */
  public updateCfg(option?: LayoutOption) {
    if (option) {
      this.updateOption(option);
    }
  }

  /**
   * @description Get Layout Option
   * @description.zh-CN 获取布局的配置
   */
  public getOption() {
    return {...this.option};
  }

  /**
   * @description Layout Data
   * @description.zh-CN 布局的数据
   */
  protected data: DataModel;

}

export class Layout<DataModel = Model> extends BaseLayout<DataModel> {
  public execute() {
    // some layout things

    return this.data;
  }

  public layout(data: DataModel) {
    const { onLayoutEnd } = this.option;
    this.data = data;

    const result = this.execute();

    if (onLayoutEnd) {
      onLayoutEnd();
    }

    return result;
  }
}

export class AsyncLayout<DataModel = Model> extends BaseLayout<DataModel> {
  public async execute() {
    // some layout things

    return this.data;
  }

  public async layout(data: DataModel) {
    const { onLayoutEnd } = this.option;
    this.data = data;

    const result = await this.execute();

    if (onLayoutEnd) {
      onLayoutEnd();
    }

    return result;
  }
}
