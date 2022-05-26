import { NodeSize, Node, PossibleNodeSize } from "layouts/types";
import { isArray } from "./array";
import { isNumber } from "./number";
import { isObject } from "./object";

export const isFunction = (val: any) => typeof val === 'function';


export const getFunc = (
  value: number,
  defaultValue: number,
  func?: ((d?: any) => number) | undefined,
) => {
  let resultFunc;
  if (func) {
    resultFunc = func;
  } else if (isNumber(value)) {
    resultFunc = () => value;
  } else {
    resultFunc = () => defaultValue;
  }
  return resultFunc;
};

export const getFuncByUnknownType = (
  defaultValue: number,
  value?: NodeSize
): (d?: any) => number => {
  if (!value && value !== 0) {
    return (d) => {
      if (d.size) {
        if (isArray(d.size)) return d.size[0] > d.size[1] ? d.size[0] : d.size[1];
        if (isObject(d.size)) return d.size.width > d.size.height ? d.size.width : d.size.height;
        return d.size;
      }
      return defaultValue;
    };
  }
  return (d) =>{
    const size = getNodeSize(value, d);
    return size ? Math.max(...size) : defaultValue;
  };
};


export const getNodeSize = (size: NodeSize, node: Node) => {
  if (typeof size === 'number') {
    return [size, size];
  }

  if (Array.isArray(size)) {
    return size;
  }

  if (size && typeof size === 'object') {
    return [size.width, size.height];
  }

  if (typeof size === 'function') {
    return getNodeSize(size(node), node);
  }

  return [10, 10]
}
