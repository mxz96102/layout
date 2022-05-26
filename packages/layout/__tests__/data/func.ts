import { Node, OutNode } from "../../src/layout/types";

export const getRandomNodes = (num = 10) => {
  // return the number of random nodes with random id
  const nodes: Node[] = [];
  for (let i = 0; i < num; i++) {
    nodes.push({
      id: `${i}`,
    });
  }
  return nodes as OutNode[];
}