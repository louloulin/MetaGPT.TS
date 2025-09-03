/**
 * Action Orchestrator System
 * 
 * Manages complex action workflows with dependency resolution, parallel execution,
 * error handling, and rollback capabilities.
 * 
 * @module actions/action-orchestrator
 * @category Core
 */

import { ActionNode, ActionNodeStatus, ActionNodeResult, ActionNodeExecutionContext } from './action-node';
import { logger } from '../utils/logger';
import { SerializationMixin } from '../base/serialization';

/**
 * Orchestration execution mode
 */
export enum OrchestrationMode {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  MIXED = 'mixed'
}

/**
 * Orchestration status
 */
export enum OrchestrationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ROLLED_BACK = 'rolled_back'
}

/**
 * Orchestration configuration
 */
export interface OrchestrationConfig {
  /** Orchestration identifier */
  id: string;
  /** Execution mode */
  mode: OrchestrationMode;
  /** Maximum concurrent executions */
  maxConcurrency?: number;
  /** Global timeout in milliseconds */
  timeout?: number;
  /** Enable automatic rollback on failure */
  autoRollback?: boolean;
  /** Continue execution on non-critical failures */
  continueOnError?: boolean;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    delay: number;
    backoff: number;
  };
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
  /** Orchestration identifier */
  orchestrationId: string;
  /** Execution success status */
  success: boolean;
  /** Individual node results */
  results: ActionNodeResult[];
  /** Total execution duration */
  duration: number;
  /** Error information */
  error?: Error;
  /** Execution metadata */
  metadata?: Record<string, any>;
}

/**
 * Execution record for history tracking
 */
export interface ExecutionRecord {
  /** Execution timestamp */
  timestamp: Date;
  /** Execution duration */
  duration: number;
  /** Node results */
  results: ActionNodeResult[];
  /** Success status */
  success: boolean;
  /** Error information */
  error?: Error;
}

/**
 * Action Orchestrator class for managing complex action workflows
 */
export class ActionOrchestrator extends SerializationMixin {
  /** Orchestration configuration */
  private config: OrchestrationConfig;
  
  /** Registered nodes */
  private nodes: Map<string, ActionNode> = new Map();
  
  /** Execution history */
  private executionHistory: ExecutionRecord[] = [];
  
  /** Current orchestration status */
  private status: OrchestrationStatus = OrchestrationStatus.PENDING;
  
  /** Execution start time */
  private startTime: number = 0;
  
  /** Execution duration */
  private duration: number = 0;
  
  /** Current execution context */
  private currentContext: ActionNodeExecutionContext | null = null;
  
  /** Execution metadata */
  private metadata: Record<string, any> = {};

  constructor(config: OrchestrationConfig) {
    super();
    this.config = { ...config };
    this.validateConfig();
  }

  /**
   * Validate orchestration configuration
   */
  private validateConfig(): void {
    if (!this.config.id || this.config.id.trim().length === 0) {
      throw new Error('Orchestration ID is required');
    }

    if (this.config.maxConcurrency !== undefined && this.config.maxConcurrency < 1) {
      throw new Error('Max concurrency must be at least 1');
    }

    if (this.config.timeout !== undefined && this.config.timeout < 0) {
      throw new Error('Timeout must be non-negative');
    }
  }

  /**
   * Add a node to the orchestration
   */
  addNode(node: ActionNode): void {
    if (this.nodes.has(node.key)) {
      throw new Error(`Node with key '${node.key}' already exists`);
    }
    
    this.nodes.set(node.key, node);
    logger.debug(`[Orchestrator:${this.config.id}] Added node: ${node.key}`);
  }

  /**
   * Remove a node from the orchestration
   */
  removeNode(nodeKey: string): boolean {
    const removed = this.nodes.delete(nodeKey);
    if (removed) {
      logger.debug(`[Orchestrator:${this.config.id}] Removed node: ${nodeKey}`);
    }
    return removed;
  }

  /**
   * Get a node by key
   */
  getNode(nodeKey: string): ActionNode | undefined {
    return this.nodes.get(nodeKey);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): ActionNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Add dependency between nodes
   */
  addDependency(fromNodeKey: string, toNodeKey: string): void {
    const fromNode = this.nodes.get(fromNodeKey);
    const toNode = this.nodes.get(toNodeKey);
    
    if (!fromNode) {
      throw new Error(`Source node '${fromNodeKey}' not found`);
    }
    
    if (!toNode) {
      throw new Error(`Target node '${toNodeKey}' not found`);
    }
    
    toNode.addDependency(fromNode);
    logger.debug(`[Orchestrator:${this.config.id}] Added dependency: ${fromNodeKey} -> ${toNodeKey}`);
  }

  /**
   * Remove dependency between nodes
   */
  removeDependency(fromNodeKey: string, toNodeKey: string): void {
    const fromNode = this.nodes.get(fromNodeKey);
    const toNode = this.nodes.get(toNodeKey);
    
    if (fromNode && toNode) {
      toNode.removeDependency(fromNode);
      logger.debug(`[Orchestrator:${this.config.id}] Removed dependency: ${fromNodeKey} -> ${toNodeKey}`);
    }
  }

  /**
   * Get entry nodes (nodes with no dependencies)
   */
  getEntryNodes(): ActionNode[] {
    return Array.from(this.nodes.values()).filter(node => 
      node.getDependencies().length === 0
    );
  }

  /**
   * Check for circular dependencies
   */
  hasCircularDependencies(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (nodeKey: string): boolean => {
      if (recursionStack.has(nodeKey)) {
        return true;
      }
      
      if (visited.has(nodeKey)) {
        return false;
      }
      
      visited.add(nodeKey);
      recursionStack.add(nodeKey);
      
      const node = this.nodes.get(nodeKey);
      if (node) {
        for (const dependent of node.getDependents()) {
          if (hasCycle(dependent.key)) {
            return true;
          }
        }
      }
      
      recursionStack.delete(nodeKey);
      return false;
    };
    
    for (const nodeKey of this.nodes.keys()) {
      if (!visited.has(nodeKey)) {
        if (hasCycle(nodeKey)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get topological order of nodes
   */
  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    
    const visit = (nodeKey: string) => {
      if (visited.has(nodeKey)) {
        return;
      }
      
      visited.add(nodeKey);
      
      const node = this.nodes.get(nodeKey);
      if (node) {
        // Visit dependencies first
        for (const dep of node.getDependencies()) {
          visit(dep.key);
        }
        
        order.push(nodeKey);
      }
    };
    
    for (const nodeKey of this.nodes.keys()) {
      visit(nodeKey);
    }
    
    return order;
  }

  /**
   * Get orchestration status
   */
  getStatus(): OrchestrationStatus {
    return this.status;
  }

  /**
   * Get execution duration
   */
  getDuration(): number {
    return this.duration;
  }

  /**
   * Get execution metadata
   */
  getMetadata(): Record<string, any> {
    return { ...this.metadata };
  }

  /**
   * Set execution metadata
   */
  setMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): ExecutionRecord[] {
    return [...this.executionHistory];
  }

  /**
   * Get serialization path
   */
  getSerializationPath(): string {
    return `./serialized/ActionOrchestrator_${this.config.id}_${Date.now()}.json`;
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON(): Record<string, any> {
    return {
      config: this.config,
      nodes: Array.from(this.nodes.entries()).map(([key, node]) => [key, node.toJSON()]),
      executionHistory: this.executionHistory,
      status: this.status,
      duration: this.duration,
      metadata: this.metadata
    };
  }

  /**
   * Create from JSON data
   */
  static fromJSON(data: Record<string, any>): ActionOrchestrator {
    const orchestrator = new ActionOrchestrator(data.config);

    // Restore nodes
    for (const [key, nodeData] of data.nodes) {
      const node = ActionNode.fromJSON(nodeData);
      orchestrator.nodes.set(key, node);
    }

    orchestrator.executionHistory = data.executionHistory || [];
    orchestrator.status = data.status || OrchestrationStatus.PENDING;
    orchestrator.duration = data.duration || 0;
    orchestrator.metadata = data.metadata || {};

    return orchestrator;
  }

  /**
   * Execute the orchestration
   */
  async execute(context: ActionNodeExecutionContext): Promise<OrchestrationResult> {
    if (this.status === OrchestrationStatus.RUNNING) {
      throw new Error('Orchestration is already running');
    }

    // Check for circular dependencies
    if (this.hasCircularDependencies()) {
      throw new Error('Circular dependencies detected');
    }

    this.startTime = Date.now();
    this.status = OrchestrationStatus.RUNNING;
    this.currentContext = context;

    logger.info(`[Orchestrator:${this.config.id}] Starting execution with ${this.nodes.size} nodes`);

    try {
      let results: ActionNodeResult[];

      switch (this.config.mode) {
        case OrchestrationMode.SEQUENTIAL:
          results = await this.executeSequential(context);
          break;
        case OrchestrationMode.PARALLEL:
          results = await this.executeParallel(context);
          break;
        case OrchestrationMode.MIXED:
          results = await this.executeMixed(context);
          break;
        default:
          throw new Error(`Unsupported orchestration mode: ${this.config.mode}`);
      }

      this.status = OrchestrationStatus.COMPLETED;
      this.duration = Date.now() - this.startTime;

      const orchestrationResult: OrchestrationResult = {
        orchestrationId: this.config.id,
        success: results.every(r => r.success),
        results,
        duration: this.duration,
        metadata: { ...this.metadata }
      };

      // Record execution history
      this.executionHistory.push({
        timestamp: new Date(),
        duration: this.duration,
        results,
        success: orchestrationResult.success
      });

      logger.info(`[Orchestrator:${this.config.id}] Execution completed in ${this.duration}ms`);

      return orchestrationResult;

    } catch (error) {
      this.status = OrchestrationStatus.FAILED;
      this.duration = Date.now() - this.startTime;

      logger.error(`[Orchestrator:${this.config.id}] Execution failed:`, error);

      // Auto rollback if enabled
      if (this.config.autoRollback) {
        await this.rollback();
        // Reset status to failed after rollback for proper error reporting
        this.status = OrchestrationStatus.FAILED;
      }

      const orchestrationResult: OrchestrationResult = {
        orchestrationId: this.config.id,
        success: false,
        results: [],
        duration: this.duration,
        error: error as Error,
        metadata: { ...this.metadata }
      };

      // Record execution history
      this.executionHistory.push({
        timestamp: new Date(),
        duration: this.duration,
        results: [],
        success: false,
        error: error as Error
      });

      return orchestrationResult;
    }
  }

  /**
   * Execute nodes sequentially
   */
  private async executeSequential(context: ActionNodeExecutionContext): Promise<ActionNodeResult[]> {
    const results: ActionNodeResult[] = [];
    const topologicalOrder = this.getTopologicalOrder();

    for (const nodeKey of topologicalOrder) {
      const node = this.nodes.get(nodeKey);
      if (!node) {
        continue;
      }

      logger.debug(`[Orchestrator:${this.config.id}] Executing node: ${nodeKey}`);

      const result = await this.executeNodeWithRetry(node, context);
      results.push(result);

      if (!result.success && !this.config.continueOnError) {
        throw new Error(`Node ${nodeKey} failed: ${result.error?.message}`);
      }
    }

    return results;
  }

  /**
   * Execute nodes in parallel where possible
   */
  private async executeParallel(context: ActionNodeExecutionContext): Promise<ActionNodeResult[]> {
    const results: ActionNodeResult[] = [];
    const completed = new Set<string>();
    const running = new Map<string, Promise<ActionNodeResult>>();
    const maxConcurrency = this.config.maxConcurrency || 10;

    while (completed.size < this.nodes.size) {
      // Find nodes ready to execute
      const readyNodes = Array.from(this.nodes.values()).filter(node =>
        !completed.has(node.key) &&
        !running.has(node.key) &&
        node.getDependencies().every(dep => completed.has(dep.key))
      );

      // Start execution for ready nodes (up to concurrency limit)
      const availableSlots = maxConcurrency - running.size;
      const nodesToStart = readyNodes.slice(0, availableSlots);

      for (const node of nodesToStart) {
        logger.debug(`[Orchestrator:${this.config.id}] Starting parallel execution: ${node.key}`);

        const promise = this.executeNodeWithRetry(node, context);
        running.set(node.key, promise);
      }

      // Wait for at least one node to complete
      if (running.size > 0) {
        const raceResult = await Promise.race(
          Array.from(running.entries()).map(async ([key, promise]) => {
            const result = await promise;
            return { key, result };
          })
        );

        const { key, result } = raceResult;
        running.delete(key);
        completed.add(key);
        results.push(result);

        if (!result.success && !this.config.continueOnError) {
          // Cancel remaining executions
          await this.cancelRunningNodes(running);
          throw new Error(`Node ${key} failed: ${result.error?.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Execute with mixed strategy (parallel where possible, sequential where needed)
   */
  private async executeMixed(context: ActionNodeExecutionContext): Promise<ActionNodeResult[]> {
    // For now, use parallel execution as the mixed strategy
    // This can be enhanced to use more sophisticated scheduling
    return await this.executeParallel(context);
  }

  /**
   * Execute a node with retry logic
   */
  private async executeNodeWithRetry(
    node: ActionNode,
    context: ActionNodeExecutionContext
  ): Promise<ActionNodeResult> {
    const retryConfig = this.config.retry;
    let lastError: Error | null = null;
    let attempt = 0;
    const maxAttempts = retryConfig?.maxAttempts || 1;

    while (attempt < maxAttempts) {
      try {
        const result = await node.execute(context);

        if (result.success) {
          if (attempt > 0) {
            logger.info(`[Orchestrator:${this.config.id}] Node ${node.key} succeeded on attempt ${attempt + 1}`);
          }
          return result;
        }

        lastError = result.error || new Error('Unknown execution error');

      } catch (error) {
        lastError = error as Error;
      }

      attempt++;

      if (attempt < maxAttempts && retryConfig) {
        const delay = retryConfig.delay * Math.pow(retryConfig.backoff || 1, attempt - 1);
        logger.warn(`[Orchestrator:${this.config.id}] Node ${node.key} failed on attempt ${attempt}, retrying in ${delay}ms`);
        await this.sleep(delay);
      }
    }

    logger.error(`[Orchestrator:${this.config.id}] Node ${node.key} failed after ${maxAttempts} attempts`);

    return {
      nodeId: node.key,
      success: false,
      error: lastError || new Error('Max retry attempts exceeded'),
      duration: 0
    };
  }

  /**
   * Cancel running nodes
   */
  private async cancelRunningNodes(running: Map<string, Promise<ActionNodeResult>>): Promise<void> {
    logger.warn(`[Orchestrator:${this.config.id}] Cancelling ${running.size} running nodes`);

    // Note: JavaScript doesn't have built-in promise cancellation
    // This is a placeholder for cancellation logic
    for (const [nodeKey] of running) {
      const node = this.nodes.get(nodeKey);
      if (node && node.nodeStatus === ActionNodeStatus.RUNNING) {
        // Mark node as cancelled - actual cancellation would depend on implementation
        logger.debug(`[Orchestrator:${this.config.id}] Marking node ${nodeKey} as cancelled`);
      }
    }
  }

  /**
   * Rollback all completed nodes
   */
  async rollback(): Promise<void> {
    if (this.status !== OrchestrationStatus.FAILED && this.status !== OrchestrationStatus.COMPLETED) {
      throw new Error('Can only rollback failed or completed orchestrations');
    }

    logger.info(`[Orchestrator:${this.config.id}] Starting rollback`);
    this.status = OrchestrationStatus.RUNNING;

    const completedNodes = Array.from(this.nodes.values())
      .filter(node => node.nodeStatus === ActionNodeStatus.COMPLETED)
      .reverse(); // Rollback in reverse order

    const rollbackPromises = completedNodes.map(async (node) => {
      try {
        await node.rollback();
        logger.debug(`[Orchestrator:${this.config.id}] Rolled back node: ${node.key}`);
      } catch (error) {
        logger.error(`[Orchestrator:${this.config.id}] Failed to rollback node ${node.key}:`, error);
      }
    });

    await Promise.all(rollbackPromises);

    this.status = OrchestrationStatus.ROLLED_BACK;
    logger.info(`[Orchestrator:${this.config.id}] Rollback completed`);
  }

  /**
   * Reset all nodes to pending status
   */
  reset(): void {
    for (const node of this.nodes.values()) {
      node.reset();
    }

    this.status = OrchestrationStatus.PENDING;
    this.duration = 0;
    this.startTime = 0;
    this.currentContext = null;
    this.metadata = {};

    logger.info(`[Orchestrator:${this.config.id}] Reset completed`);
  }

  /**
   * Get orchestration summary
   */
  getSummary(): Record<string, any> {
    const nodeStatuses = Array.from(this.nodes.values()).reduce((acc, node) => {
      const status = node.nodeStatus;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      id: this.config.id,
      status: this.status,
      nodeCount: this.nodes.size,
      nodeStatuses,
      duration: this.duration,
      executionCount: this.executionHistory.length,
      hasCircularDependencies: this.hasCircularDependencies()
    };
  }

  /**
   * Visualize orchestration as DOT format
   */
  toDOT(): string {
    let dot = `digraph ActionOrchestrator_${this.config.id} {\n`;
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes
    for (const node of this.nodes.values()) {
      const status = node.nodeStatus;
      let color = 'gray';

      switch (status) {
        case ActionNodeStatus.PENDING:
          color = 'lightgray';
          break;
        case ActionNodeStatus.RUNNING:
          color = 'yellow';
          break;
        case ActionNodeStatus.COMPLETED:
          color = 'lightgreen';
          break;
        case ActionNodeStatus.FAILED:
          color = 'lightcoral';
          break;
        case ActionNodeStatus.CANCELLED:
          color = 'orange';
          break;
        case ActionNodeStatus.ROLLED_BACK:
          color = 'lightblue';
          break;
      }

      dot += `  "${node.key}" [label="${node.key}\\n(${status})", fillcolor="${color}", style="filled"];\n`;
    }

    dot += '\n';

    // Add edges
    for (const node of this.nodes.values()) {
      for (const dependent of node.getDependents()) {
        dot += `  "${node.key}" -> "${dependent.key}";\n`;
      }
    }

    dot += '}';
    return dot;
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
