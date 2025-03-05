import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionNode, ActionGraph } from '../../src/workflow/action-graph';
import type { Action, ActionOutput } from '../../src/types/action';

// Mock Action implementation for testing
const createMockAction = (id: string): Action => ({
  name: `Action${id}`,
  context: {
    name: `Action${id}Context`,
    description: '',
    memory: null,
    workingMemory: null,
    llm: null,
  },
  llm: {} as any,
  prefix: `Action${id}Prefix`,
  desc: `Action${id} Description`,
  run: vi.fn().mockResolvedValue({
    content: `result-${id}`,
    status: 'completed'
  }),
  handleException: vi.fn(),
  setPrefix: function(prefix) { return this; }
});

describe('Action Graph System', () => {
  describe('ActionNode', () => {
    let action: Action;
    let node: ActionNode;
    
    beforeEach(() => {
      action = createMockAction('test');
      node = new ActionNode(action);
    });
    
    it('should create a node with an action', () => {
      expect(node.id).toBeDefined();
      expect(node.action).toBe(action);
      expect(node.getStatus()).toBe('pending');
      expect(node.getResult()).toBeNull();
    });
    
    it('should add dependencies', () => {
      const dep1 = new ActionNode(createMockAction('dep1'));
      const dep2 = new ActionNode(createMockAction('dep2'));
      
      node.addPrev(dep1);
      node.addPrev(dep2);
      dep1.addNext(node);
      dep2.addNext(node);
      
      expect(node.getPrevNodes()).toContain(dep1);
      expect(node.getPrevNodes()).toContain(dep2);
      expect(dep1.getNextNodes()).toContain(node);
      expect(dep2.getNextNodes()).toContain(node);
    });
    
    it('should check if dependencies are completed', () => {
      const dep1 = new ActionNode(createMockAction('dep1'));
      const dep2 = new ActionNode(createMockAction('dep2'));
      
      node.addPrev(dep1);
      node.addPrev(dep2);
      
      expect(node.areDependenciesSatisfied()).toBe(false);
      
      dep1.setStatus('completed');
      expect(node.areDependenciesSatisfied()).toBe(false);
      
      dep2.setStatus('completed');
      expect(node.areDependenciesSatisfied()).toBe(true);
    });
    
    it('should reset the node status', () => {
      node.setStatus('completed');
      node.setResult({ content: 'test result', status: 'completed' });
      
      node.setStatus('pending');
      node.setResult(null);
      
      expect(node.getStatus()).toBe('pending');
      expect(node.getResult()).toBeNull();
    });
  });
  
  describe('ActionGraph', () => {
    let graph: ActionGraph;
    
    beforeEach(() => {
      graph = new ActionGraph();
    });
    
    it('should add nodes to the graph', () => {
      const action1 = createMockAction('1');
      const action2 = createMockAction('2');
      
      const node1 = graph.addNode(action1);
      const node2 = graph.addNode(action2);
      
      expect(graph.getNode(node1.id)).toBeDefined();
      expect(graph.getNode(node2.id)).toBeDefined();
    });
    
    it('should add edges between nodes', () => {
      const action1 = createMockAction('1');
      const action2 = createMockAction('2');
      
      const node1 = graph.addNode(action1);
      const node2 = graph.addNode(action2);
      
      graph.addEdge(action1, action2);
      
      const retrievedNode1 = graph.getNode(node1.id);
      const retrievedNode2 = graph.getNode(node2.id);
      
      expect(retrievedNode1?.getNextNodes()).toContainEqual(retrievedNode2);
      expect(retrievedNode2?.getPrevNodes()).toContainEqual(retrievedNode1);
    });
    
    it('should perform topological sort', () => {
      // Create a simple DAG:
      // A -> B -> D
      // |    ^
      // v    |
      // C ----
      const actionA = createMockAction('A');
      const actionB = createMockAction('B');
      const actionC = createMockAction('C');
      const actionD = createMockAction('D');
      
      const nodeA = graph.addNode(actionA);
      const nodeB = graph.addNode(actionB);
      const nodeC = graph.addNode(actionC);
      const nodeD = graph.addNode(actionD);
      
      graph.addEdge(actionA, actionB);
      graph.addEdge(actionA, actionC);
      graph.addEdge(actionC, actionB);
      graph.addEdge(actionB, actionD);
      
      graph.topologicalSort();
      const order = graph.getExecutionOrder();
      
      // Check proper ordering of dependencies
      expect(order.indexOf(nodeA.id)).toBeLessThan(order.indexOf(nodeB.id));
      expect(order.indexOf(nodeA.id)).toBeLessThan(order.indexOf(nodeC.id));
      expect(order.indexOf(nodeC.id)).toBeLessThan(order.indexOf(nodeB.id));
      expect(order.indexOf(nodeB.id)).toBeLessThan(order.indexOf(nodeD.id));
    });
    
    it('should detect cycles in the graph', () => {
      const actionA = createMockAction('A');
      const actionB = createMockAction('B');
      const actionC = createMockAction('C');
      
      graph.addNode(actionA);
      graph.addNode(actionB);
      graph.addNode(actionC);
      
      graph.addEdge(actionA, actionB);
      graph.addEdge(actionB, actionC);
      graph.addEdge(actionC, actionA); // Creates a cycle
      
      expect(graph.hasCycles()).toBe(true);
      expect(() => graph.execute()).rejects.toThrow('Cannot execute graph with cycles');
    });
    
    it('should execute the graph in topological order', async () => {
      // Create a simple execution pipeline
      const actionA = createMockAction('A');
      const actionB = createMockAction('B');
      const actionC = createMockAction('C');
      const actionD = createMockAction('D');
      
      const nodeA = graph.addNode(actionA);
      const nodeB = graph.addNode(actionB);
      const nodeC = graph.addNode(actionC);
      const nodeD = graph.addNode(actionD);
      
      graph.addEdge(actionA, actionB);
      graph.addEdge(actionA, actionC);
      graph.addEdge(actionB, actionD);
      graph.addEdge(actionC, actionD);
      
      await graph.execute();
      
      // Check that all actions were executed
      expect(actionA.run).toHaveBeenCalled();
      expect(actionB.run).toHaveBeenCalled();
      expect(actionC.run).toHaveBeenCalled();
      expect(actionD.run).toHaveBeenCalled();
      
      // All nodes should be completed with results
      expect(graph.getNode(nodeA.id)?.getStatus()).toBe('completed');
      expect(graph.getNode(nodeD.id)?.getStatus()).toBe('completed');
      expect(graph.getNode(nodeA.id)?.getResult()?.content).toBe('result-A');
      expect(graph.getNode(nodeD.id)?.getResult()?.content).toBe('result-D');
    });
    
    it('should stop execution on node failure', async () => {
      // Create a graph where one node fails
      const actionA = createMockAction('A');
      const actionB = createMockAction('B');
      actionB.run = vi.fn().mockRejectedValue(new Error('Action B failed'));
      const actionC = createMockAction('C');
      
      const nodeA = graph.addNode(actionA);
      const nodeB = graph.addNode(actionB);
      const nodeC = graph.addNode(actionC);
      
      graph.addEdge(actionA, actionB);
      graph.addEdge(actionB, actionC);
      
      await expect(graph.execute()).rejects.toThrow('Action B failed');
      
      expect(graph.getNode(nodeA.id)?.getStatus()).toBe('completed');
      expect(graph.getNode(nodeB.id)?.getStatus()).toBe('failed');
      expect(graph.getNode(nodeC.id)?.getStatus()).toBe('pending');
      
      // Node C should not have been executed
      expect(actionC.run).not.toHaveBeenCalled();
    });
    
    it('should reset all nodes in the graph', async () => {
      const actionA = createMockAction('A');
      const actionB = createMockAction('B');
      
      const nodeA = graph.addNode(actionA);
      const nodeB = graph.addNode(actionB);
      
      await graph.execute();
      
      expect(graph.getNode(nodeA.id)?.getStatus()).toBe('completed');
      expect(graph.getNode(nodeB.id)?.getStatus()).toBe('completed');
      
      graph.reset();
      
      expect(graph.getNode(nodeA.id)?.getStatus()).toBe('pending');
      expect(graph.getNode(nodeA.id)?.getResult()).toBeNull();
      expect(graph.getNode(nodeB.id)?.getStatus()).toBe('pending');
    });
    
    it('should generate DOT representation of the graph', () => {
      const actionA = createMockAction('A');
      const actionB = createMockAction('B');
      const actionC = createMockAction('C');
      
      const nodeA = graph.addNode(actionA);
      const nodeB = graph.addNode(actionB);
      const nodeC = graph.addNode(actionC);
      
      graph.addEdge(actionA, actionB);
      graph.addEdge(actionA, actionC);
      
      const dot = graph.toDOT();
      
      expect(dot).toMatch(/digraph/);
      expect(dot).toMatch(/ActionA/);
      expect(dot).toMatch(/ActionB/);
      expect(dot).toMatch(/ActionC/);
      // Check that there are connections from nodeA to others
      expect(dot).toContain(`"${nodeA.id}" ->`);
      // Check that nodeB and nodeC appear in the DOT output
      expect(dot).toContain(`"${nodeB.id}"`);
      expect(dot).toContain(`"${nodeC.id}"`);
    });
  });
}); 