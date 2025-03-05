/**
 * Action Graph System
 * 
 * Provides a directed graph implementation for representing and managing
 * dependencies between actions. Handles topological sorting for execution order.
 * 
 * @module workflow/action-graph
 * @category Core
 */

import type { Action, ActionOutput } from '../types/action';
import { v4 as uuidv4 } from 'uuid';
import type { Context } from '../context/context';
import { ContextImpl } from '../context/context';

/**
 * Action node representing a node in the action graph
 */
export class ActionNode {
  /** Unique identifier for this node */
  public readonly id: string;
  
  /** The action this node represents */
  public readonly action: Action;
  
  /** Nodes that depend on this node (children) */
  private nextNodes: ActionNode[] = [];
  
  /** Nodes this node depends on (parents) */
  private prevNodes: ActionNode[] = [];
  
  /** Node metadata */
  private metadata: Record<string, any> = {};
  
  /** Node status */
  private status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
  
  /** Node result */
  private result: ActionOutput | null = null;
  
  /**
   * Create a new action node
   * @param action The action this node represents
   * @param id Optional ID for the node (generated if not provided)
   */
  constructor(action: Action, id?: string) {
    this.id = id || uuidv4();
    this.action = action;
  }
  
  /**
   * Get the unique key for this node
   */
  get key(): string {
    return this.id;
  }
  
  /**
   * Add a node that depends on this node
   * @param node Node that depends on this node
   */
  addNext(node: ActionNode): void {
    if (!this.nextNodes.includes(node)) {
      this.nextNodes.push(node);
    }
  }
  
  /**
   * Add a node this node depends on
   * @param node Node this node depends on
   */
  addPrev(node: ActionNode): void {
    if (!this.prevNodes.includes(node)) {
      this.prevNodes.push(node);
    }
  }
  
  /**
   * Get nodes that depend on this node
   * @returns Array of dependent nodes
   */
  getNextNodes(): ActionNode[] {
    return [...this.nextNodes];
  }
  
  /**
   * Get nodes this node depends on
   * @returns Array of dependency nodes
   */
  getPrevNodes(): ActionNode[] {
    return [...this.prevNodes];
  }
  
  /**
   * Check if this node has any dependencies
   * @returns True if this node has dependencies
   */
  hasDependencies(): boolean {
    return this.prevNodes.length > 0;
  }
  
  /**
   * Check if all dependencies are satisfied
   * @returns True if all dependencies are satisfied
   */
  areDependenciesSatisfied(): boolean {
    return this.prevNodes.every(node => node.status === 'completed');
  }
  
  /**
   * Get the node's status
   * @returns Node status
   */
  getStatus(): string {
    return this.status;
  }
  
  /**
   * Set the node's status
   * @param status New status
   */
  setStatus(status: 'pending' | 'running' | 'completed' | 'failed'): void {
    this.status = status;
  }
  
  /**
   * Get the node's result
   * @returns Node result
   */
  getResult(): ActionOutput | null {
    return this.result;
  }
  
  /**
   * Set the node's result
   * @param result Action execution result
   */
  setResult(result: ActionOutput | null): void {
    this.result = result;
  }
  
  /**
   * Get node metadata
   * @param key Metadata key
   * @returns Metadata value
   */
  getMetadata<T>(key: string): T | undefined {
    return this.metadata[key] as T | undefined;
  }
  
  /**
   * Set node metadata
   * @param key Metadata key
   * @param value Metadata value
   */
  setMetadata<T>(key: string, value: T): void {
    this.metadata[key] = value;
  }
}

/**
 * Action graph for managing action dependencies
 */
export class ActionGraph {
  /** Nodes in the graph by ID */
  private nodes: Record<string, ActionNode> = {};
  
  /** Edge list (source node ID -> target node IDs) */
  private edges: Record<string, string[]> = {};
  
  /** Execution order from topological sort */
  private executionOrder: string[] = [];
  
  /** Context for action execution */
  private context: Context;
  
  /** Whether the graph has been modified since last sort */
  private modified = true;
  
  /**
   * Create a new action graph
   * @param context Optional context for action execution
   */
  constructor(context?: Context) {
    this.context = context || new ContextImpl();
  }
  
  /**
   * Add a node to the graph
   * @param action Action to add
   * @returns The created node
   */
  addNode(action: Action): ActionNode {
    const node = new ActionNode(action);
    this.nodes[node.key] = node;
    this.edges[node.key] = [];
    this.modified = true;
    return node;
  }
  
  /**
   * Add an edge between two nodes
   * @param from Source node or action
   * @param to Target node or action
   */
  addEdge(from: ActionNode | Action, to: ActionNode | Action): void {
    const fromNode = from instanceof ActionNode ? from : this.findNodeByAction(from);
    const toNode = to instanceof ActionNode ? to : this.findNodeByAction(to);
    
    if (!fromNode || !toNode) {
      throw new Error('Both source and target nodes must exist in the graph');
    }
    
    if (!this.edges[fromNode.key].includes(toNode.key)) {
      this.edges[fromNode.key].push(toNode.key);
      fromNode.addNext(toNode);
      toNode.addPrev(fromNode);
      this.modified = true;
    }
  }
  
  /**
   * Find a node by its action
   * @param action Action to find
   * @returns Node if found, undefined otherwise
   */
  findNodeByAction(action: Action): ActionNode | undefined {
    return Object.values(this.nodes).find(node => node.action === action);
  }
  
  /**
   * Find a node by its ID
   * @param id Node ID
   * @returns Node if found, undefined otherwise
   */
  getNode(id: string): ActionNode | undefined {
    return this.nodes[id];
  }
  
  /**
   * Get nodes that depend on the given node or action
   * @param nodeOrAction Node or action to get dependents of
   * @returns Array of dependent nodes
   */
  getNext(nodeOrAction: ActionNode | Action): ActionNode[] {
    const node = nodeOrAction instanceof ActionNode 
      ? nodeOrAction 
      : this.findNodeByAction(nodeOrAction);
    
    if (!node) {
      return [];
    }
    
    return node.getNextNodes();
  }
  
  /**
   * Get nodes the given node or action depends on
   * @param nodeOrAction Node or action to get dependencies of
   * @returns Array of dependency nodes
   */
  getPrev(nodeOrAction: ActionNode | Action): ActionNode[] {
    const node = nodeOrAction instanceof ActionNode
      ? nodeOrAction
      : this.findNodeByAction(nodeOrAction);
    
    if (!node) {
      return [];
    }
    
    return node.getPrevNodes();
  }
  
  /**
   * Perform topological sort to determine execution order
   */
  topologicalSort(): void {
    if (!this.modified) {
      return; // Skip if not modified since last sort
    }
    
    // Reset execution order
    this.executionOrder = [];
    
    // Track visited nodes
    const visited = new Set<string>();
    
    // Recursive visit function
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }
      
      visited.add(nodeId);
      
      // Visit all dependencies first
      for (const nextNodeId of this.edges[nodeId] || []) {
        visit(nextNodeId);
      }
      
      // Add this node to the execution order
      this.executionOrder.unshift(nodeId);
    };
    
    // Visit all nodes
    for (const nodeId of Object.keys(this.nodes)) {
      visit(nodeId);
    }
    
    this.modified = false;
  }
  
  /**
   * Get the execution order
   * @returns Array of node IDs in execution order
   */
  getExecutionOrder(): string[] {
    if (this.modified) {
      this.topologicalSort();
    }
    
    return [...this.executionOrder];
  }
  
  /**
   * Get all entry nodes (nodes with no dependencies)
   * @returns Array of entry nodes
   */
  getEntryNodes(): ActionNode[] {
    return Object.values(this.nodes).filter(node => !node.hasDependencies());
  }
  
  /**
   * Check if the graph contains cycles
   * @returns True if the graph contains cycles
   */
  hasCycles(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    let hasCycle = false;
    
    const visit = (nodeId: string) => {
      if (hasCycle) {
        return; // Already found a cycle
      }
      
      if (recursionStack.has(nodeId)) {
        hasCycle = true;
        return;
      }
      
      if (visited.has(nodeId)) {
        return;
      }
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      for (const nextNodeId of this.edges[nodeId] || []) {
        visit(nextNodeId);
      }
      
      recursionStack.delete(nodeId);
    };
    
    for (const nodeId of Object.keys(this.nodes)) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }
    
    return hasCycle;
  }
  
  /**
   * Execute the action graph
   * @param startAction Optional starting action (executes full graph if not provided)
   * @param context Optional execution context
   * @returns Output of the last action executed
   */
  async execute(startAction?: Action, context?: Context): Promise<ActionOutput> {
    const execContext = context || this.context;
    
    // Sort nodes if needed
    if (this.modified) {
      this.topologicalSort();
    }
    
    // Check for cycles
    if (this.hasCycles()) {
      throw new Error('Cannot execute graph with cycles');
    }
    
    let lastOutput: ActionOutput | null = null;
    const startNodeId = startAction 
      ? this.findNodeByAction(startAction)?.key 
      : undefined;
    
    // Get execution order from the start node
    let nodesToExecute: string[];
    
    if (startNodeId) {
      // Find the start node index in the execution order
      const startIndex = this.executionOrder.indexOf(startNodeId);
      
      if (startIndex === -1) {
        throw new Error('Start node not found in execution order');
      }
      
      // Execute from the start node
      nodesToExecute = this.executionOrder.slice(startIndex);
    } else {
      // Execute all nodes
      nodesToExecute = [...this.executionOrder];
    }
    
    // Execute nodes in order
    for (const nodeId of nodesToExecute) {
      const node = this.nodes[nodeId];
      
      // Check if all dependencies are satisfied
      if (!node.areDependenciesSatisfied()) {
        continue;
      }
      
      // Update node status
      node.setStatus('running');
      
      try {
        // Execute the action
        const result = await node.action.run();
        
        // Update node status and result
        node.setStatus('completed');
        node.setResult(result);
        
        // Store last output
        lastOutput = result;
        
        // Store result in context for later nodes
        execContext.set(`action_result_${nodeId}`, result);
      } catch (error) {
        console.error(`Failed to execute action ${node.action.name}:`, error);
        node.setStatus('failed');
        node.setResult(null);
        
        // Stop execution if a node fails
        throw error;
      }
    }
    
    return lastOutput || { content: '', status: 'completed' };
  }
  
  /**
   * Visualize the graph as a DOT format string
   * @returns DOT format string
   */
  toDOT(): string {
    let dot = 'digraph ActionGraph {\n';
    
    // Add nodes
    for (const [id, node] of Object.entries(this.nodes)) {
      const status = node.getStatus();
      let color = '';
      
      switch (status) {
        case 'pending':
          color = 'gray';
          break;
        case 'running':
          color = 'blue';
          break;
        case 'completed':
          color = 'green';
          break;
        case 'failed':
          color = 'red';
          break;
      }
      
      dot += `  "${id}" [label="${node.action.name}", color="${color}"];\n`;
    }
    
    // Add edges
    for (const [fromId, toIds] of Object.entries(this.edges)) {
      for (const toId of toIds) {
        dot += `  "${fromId}" -> "${toId}";\n`;
      }
    }
    
    dot += '}';
    return dot;
  }
  
  /**
   * Reset all nodes to pending status
   */
  reset(): void {
    for (const node of Object.values(this.nodes)) {
      node.setStatus('pending');
      node.setResult(null);
    }
  }
  
  /**
   * Get the execution status of the graph
   * @returns 'completed' if all nodes are completed, 'failed' if any node failed,
   *          'running' if any node is running, 'pending' otherwise
   */
  getStatus(): 'pending' | 'running' | 'completed' | 'failed' {
    let hasRunning = false;
    let hasPending = false;
    
    for (const node of Object.values(this.nodes)) {
      const status = node.getStatus();
      
      if (status === 'failed') {
        return 'failed';
      } else if (status === 'running') {
        hasRunning = true;
      } else if (status === 'pending') {
        hasPending = true;
      }
    }
    
    if (hasRunning) {
      return 'running';
    } else if (hasPending) {
      return 'pending';
    } else {
      return 'completed';
    }
  }
} 