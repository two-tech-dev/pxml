import { Node } from '../parser/schema.js';

export class DependencyGraph {
  private adjacencyList = new Map<string, string[]>();
  private nodes = new Map<string, Node>();

  constructor(nodes: Node[]) {
    for (const node of nodes) {
      this.nodes.set(node.id, node);
      this.adjacencyList.set(node.id, []);
    }

    for (const node of nodes) {
      for (const dep of node.meta.depends_on) {
        if (!this.nodes.has(dep)) {
          throw new Error(`Node ${node.id} depends on missing node: ${dep}`);
        }
        // dependency edge: dep -> node.id (dep must be built before node.id)
        this.adjacencyList.get(dep)!.push(node.id);
      }
    }
  }

  getSortOrder(): string[] {
    const visited = new Map<string, 'VISITING' | 'VISITED'>();
    const order: string[] = [];

    const visit = (nodeId: string) => {
      const state = visited.get(nodeId);
      if (state === 'VISITING') {
        throw new Error(`Circular dependency detected involving node: ${nodeId}`);
      }
      if (state === 'VISITED') {
        return;
      }

      visited.set(nodeId, 'VISITING');

      const neighbors = this.adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        visit(neighbor);
      }

      visited.set(nodeId, 'VISITED');
      order.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    // Since we put dependencies first, we reverse the topological sort order
    return order.reverse();
  }
}
