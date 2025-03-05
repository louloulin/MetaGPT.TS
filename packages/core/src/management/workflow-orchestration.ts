import { z } from 'zod';
import type { TeamCollaboration } from './team-collaboration';
import { TaskState, type Task } from './team-collaboration';
import { logger } from '../utils/logger';

/**
 * Workflow node types
 */
export enum WorkflowNodeType {
  START = 'start',
  END = 'end',
  TASK = 'task',
  CONDITION = 'condition',
  FORK = 'fork',
  JOIN = 'join',
}

/**
 * Workflow node schema
 */
export const WorkflowNodeSchema = z.object({
  /** Node identifier */
  id: z.string(),
  /** Node type */
  type: z.nativeEnum(WorkflowNodeType),
  /** Node name */
  name: z.string(),
  /** Node description */
  description: z.string().default(''),
  /** Associated task ID (for TASK nodes) */
  taskId: z.string().optional(),
  /** Condition expression (for CONDITION nodes) */
  condition: z.string().optional(),
  /** Input parameters */
  inputs: z.record(z.any()).default({}),
  /** Output parameters */
  outputs: z.record(z.any()).default({}),
  /** Node metadata */
  metadata: z.record(z.any()).default({}),
});

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

/**
 * Workflow edge schema (connection between nodes)
 */
export const WorkflowEdgeSchema = z.object({
  /** Edge identifier */
  id: z.string(),
  /** Source node ID */
  source: z.string(),
  /** Target node ID */
  target: z.string(),
  /** Edge label */
  label: z.string().default(''),
  /** Condition to evaluate (for conditional edges) */
  condition: z.string().optional(),
  /** Edge metadata */
  metadata: z.record(z.any()).default({}),
});

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

/**
 * Workflow definition schema
 */
export const WorkflowDefinitionSchema = z.object({
  /** Workflow identifier */
  id: z.string(),
  /** Workflow name */
  name: z.string(),
  /** Workflow description */
  description: z.string().default(''),
  /** Workflow nodes */
  nodes: z.array(WorkflowNodeSchema).default([]),
  /** Workflow edges */
  edges: z.array(WorkflowEdgeSchema).default([]),
  /** Workflow inputs */
  inputs: z.record(z.any()).default({}),
  /** Workflow outputs */
  outputs: z.record(z.any()).default({}),
  /** Workflow metadata */
  metadata: z.record(z.any()).default({}),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

/**
 * Workflow instance state
 */
export enum WorkflowInstanceState {
  CREATED = 'created',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
  CANCELED = 'canceled',
}

/**
 * Workflow instance schema
 */
export const WorkflowInstanceSchema = z.object({
  /** Instance identifier */
  id: z.string(),
  /** Associated workflow definition ID */
  workflowId: z.string(),
  /** Instance state */
  state: z.nativeEnum(WorkflowInstanceState).default(WorkflowInstanceState.CREATED),
  /** Current active nodes */
  activeNodes: z.array(z.string()).default([]),
  /** Completed nodes */
  completedNodes: z.array(z.string()).default([]),
  /** Node results */
  nodeResults: z.record(z.any()).default({}),
  /** Workflow variables */
  variables: z.record(z.any()).default({}),
  /** Start time */
  startTime: z.date().optional(),
  /** End time */
  endTime: z.date().optional(),
  /** Error information */
  error: z.string().optional(),
});

export type WorkflowInstance = z.infer<typeof WorkflowInstanceSchema>;

/**
 * Configuration for WorkflowOrchestration
 */
export const WorkflowOrchestrationConfigSchema = z.object({
  /** Team collaboration reference */
  teamCollaboration: z.any(),
  /** Maximum parallel tasks */
  maxParallelTasks: z.number().default(10),
  /** Enable auto-recovery */
  enableAutoRecovery: z.boolean().default(true),
  /** Workflow execution timeout (ms) */
  executionTimeout: z.number().default(3600000), // 1 hour
});

export type WorkflowOrchestrationConfig = z.infer<typeof WorkflowOrchestrationConfigSchema>;

/**
 * WorkflowOrchestration class for managing complex workflow execution
 */
export class WorkflowOrchestration {
  /** Configuration */
  private config: WorkflowOrchestrationConfig;
  /** Team collaboration */
  private teamCollaboration: TeamCollaboration;
  /** Workflow definitions */
  private workflowDefinitions: Map<string, WorkflowDefinition> = new Map();
  /** Workflow instances */
  private workflowInstances: Map<string, WorkflowInstance> = new Map();
  /** Execution timeouts */
  private executionTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Create a new WorkflowOrchestration instance
   * @param config Configuration
   */
  constructor(config: WorkflowOrchestrationConfig) {
    this.config = WorkflowOrchestrationConfigSchema.parse(config);
    this.teamCollaboration = this.config.teamCollaboration as TeamCollaboration;
  }

  /**
   * Register a workflow definition
   * @param workflow Workflow definition
   * @returns Registered workflow
   */
  public registerWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
    // Validate workflow
    const validated = WorkflowDefinitionSchema.parse(workflow);
    
    // Ensure START and END nodes exist
    const hasStart = validated.nodes.some(node => node.type === WorkflowNodeType.START);
    const hasEnd = validated.nodes.some(node => node.type === WorkflowNodeType.END);
    
    if (!hasStart || !hasEnd) {
      throw new Error(`Workflow ${validated.id} must have START and END nodes`);
    }
    
    // Store workflow
    this.workflowDefinitions.set(validated.id, validated);
    logger.info(`Registered workflow ${validated.id}: ${validated.name}`);
    
    return validated;
  }

  /**
   * Get a workflow definition
   * @param id Workflow ID
   * @returns Workflow definition
   */
  public getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflowDefinitions.get(id);
  }

  /**
   * Create a workflow instance
   * @param workflowId Workflow definition ID
   * @param variables Initial variables
   * @returns Created workflow instance
   */
  public createWorkflowInstance(
    workflowId: string,
    variables: Record<string, any> = {}
  ): WorkflowInstance {
    const workflow = this.workflowDefinitions.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    // Generate instance ID
    const instanceId = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create instance
    const instance: WorkflowInstance = WorkflowInstanceSchema.parse({
      id: instanceId,
      workflowId,
      state: WorkflowInstanceState.CREATED,
      variables: { ...workflow.inputs, ...variables },
    });
    
    // Store instance
    this.workflowInstances.set(instanceId, instance);
    logger.info(`Created workflow instance ${instanceId} for workflow ${workflowId}`);
    
    return instance;
  }

  /**
   * Start a workflow instance
   * @param instanceId Instance ID
   * @returns Running workflow instance
   */
  public startWorkflowInstance(instanceId: string): WorkflowInstance {
    const instance = this.workflowInstances.get(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }
    
    if (instance.state !== WorkflowInstanceState.CREATED) {
      throw new Error(`Cannot start workflow instance ${instanceId} in state ${instance.state}`);
    }
    
    // Get workflow definition
    const workflow = this.workflowDefinitions.get(instance.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${instance.workflowId} not found`);
    }
    
    // Find START node
    const startNode = workflow.nodes.find(node => node.type === WorkflowNodeType.START);
    if (!startNode) {
      throw new Error(`Workflow ${instance.workflowId} has no START node`);
    }
    
    // Update instance state
    const updatedInstance: WorkflowInstance = {
      ...instance,
      state: WorkflowInstanceState.RUNNING,
      activeNodes: [startNode.id],
      startTime: new Date(),
    };
    
    // Store updated instance
    this.workflowInstances.set(instanceId, updatedInstance);
    
    // Set execution timeout
    if (this.config.executionTimeout > 0) {
      const timeout = setTimeout(() => {
        this.handleWorkflowTimeout(instanceId);
      }, this.config.executionTimeout);
      
      this.executionTimeouts.set(instanceId, timeout);
    }
    
    // Start execution
    this.executeWorkflowStep(instanceId);
    
    return updatedInstance;
  }

  /**
   * Execute a workflow step
   * @param instanceId Workflow instance ID
   */
  private async executeWorkflowStep(instanceId: string): Promise<void> {
    const instance = this.workflowInstances.get(instanceId);
    if (!instance || instance.state !== WorkflowInstanceState.RUNNING) {
      return;
    }
    
    const workflow = this.workflowDefinitions.get(instance.workflowId);
    if (!workflow) {
      return;
    }
    
    // Process each active node
    for (const nodeId of [...instance.activeNodes]) {
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      // Handle node based on type
      switch (node.type) {
        case WorkflowNodeType.START:
          await this.processStartNode(instance, workflow, node);
          break;
          
        case WorkflowNodeType.TASK:
          await this.processTaskNode(instance, workflow, node);
          break;
          
        case WorkflowNodeType.CONDITION:
          await this.processConditionNode(instance, workflow, node);
          break;
          
        case WorkflowNodeType.FORK:
          await this.processForkNode(instance, workflow, node);
          break;
          
        case WorkflowNodeType.JOIN:
          await this.processJoinNode(instance, workflow, node);
          break;
          
        case WorkflowNodeType.END:
          await this.processEndNode(instance, workflow, node);
          break;
      }
    }
    
    // Check if workflow is complete or needs to continue
    this.checkWorkflowCompletion(instanceId);
  }

  /**
   * Process a START node
   */
  private async processStartNode(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    node: WorkflowNode
  ): Promise<void> {
    // Mark node as completed
    this.completeNode(instance.id, node.id, {});
    
    // Find outgoing edges
    const outgoingEdges = workflow.edges.filter(edge => edge.source === node.id);
    
    // Activate next nodes
    for (const edge of outgoingEdges) {
      this.activateNode(instance.id, edge.target);
    }
  }

  /**
   * Process a TASK node
   */
  private async processTaskNode(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    node: WorkflowNode
  ): Promise<void> {
    if (!node.taskId) {
      logger.warn(`Task node ${node.id} has no taskId`);
      this.completeNode(instance.id, node.id, { error: 'No taskId specified' });
      return;
    }
    
    const task = this.teamCollaboration.getTask(node.taskId);
    
    if (!task) {
      // Create task if it doesn't exist
      const newTask = this.teamCollaboration.createTask({
        id: node.taskId,
        title: node.name,
        description: node.description || `Task for workflow ${workflow.id}`,
        ...node.inputs,
      });
      
      // Monitor task state
      this.monitorTaskCompletion(instance.id, node.id, newTask);
    } else if (task.state === TaskState.COMPLETED) {
      // Task already completed
      this.completeNode(instance.id, node.id, { result: task.result });
      
      // Find outgoing edges
      const outgoingEdges = workflow.edges.filter(edge => edge.source === node.id);
      
      // Activate next nodes
      for (const edge of outgoingEdges) {
        this.activateNode(instance.id, edge.target);
      }
    } else if (task.state === TaskState.FAILED) {
      // Task failed
      this.failNode(instance.id, node.id, task.error || 'Task failed');
    }
  }

  /**
   * Process a CONDITION node
   */
  private async processConditionNode(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    node: WorkflowNode
  ): Promise<void> {
    // Evaluate condition
    let result = false;
    try {
      // Simple condition evaluation for demonstration
      // In a real implementation, this would use a proper expression evaluator
      if (node.condition) {
        const evalFn = new Function('variables', `return ${node.condition};`);
        result = Boolean(evalFn(instance.variables));
      }
    } catch (error) {
      logger.error(`Error evaluating condition in node ${node.id}: ${error}`);
      result = false;
    }
    
    // Mark node as completed
    this.completeNode(instance.id, node.id, { result });
    
    // Find outgoing edges
    const outgoingEdges = workflow.edges.filter(edge => {
      if (edge.source !== node.id) return false;
      
      // If edge has condition, check it
      if (edge.condition) {
        if (edge.condition === 'true' && result) return true;
        if (edge.condition === 'false' && !result) return true;
        return false;
      }
      
      return true;
    });
    
    // Activate next nodes
    for (const edge of outgoingEdges) {
      this.activateNode(instance.id, edge.target);
    }
  }

  /**
   * Process a FORK node
   */
  private async processForkNode(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    node: WorkflowNode
  ): Promise<void> {
    // Mark node as completed
    this.completeNode(instance.id, node.id, {});
    
    // Find all outgoing edges
    const outgoingEdges = workflow.edges.filter(edge => edge.source === node.id);
    
    // Activate all next nodes in parallel
    for (const edge of outgoingEdges) {
      this.activateNode(instance.id, edge.target);
    }
  }

  /**
   * Process a JOIN node
   */
  private async processJoinNode(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    node: WorkflowNode
  ): Promise<void> {
    // Find all incoming edges
    const incomingEdges = workflow.edges.filter(edge => edge.target === node.id);
    
    // Check if all source nodes are completed
    const allCompleted = incomingEdges.every(edge => {
      return instance.completedNodes.includes(edge.source);
    });
    
    if (allCompleted) {
      // Mark node as completed
      this.completeNode(instance.id, node.id, {});
      
      // Find outgoing edges
      const outgoingEdges = workflow.edges.filter(edge => edge.source === node.id);
      
      // Activate next nodes
      for (const edge of outgoingEdges) {
        this.activateNode(instance.id, edge.target);
      }
    }
  }

  /**
   * Process an END node
   */
  private async processEndNode(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    node: WorkflowNode
  ): Promise<void> {
    // Mark node as completed
    this.completeNode(instance.id, node.id, {});
    
    // Complete workflow
    this.completeWorkflow(instance.id);
  }

  /**
   * Monitor task completion
   */
  private monitorTaskCompletion(instanceId: string, nodeId: string, task: Task): void {
    // In a real implementation, this would register a callback or poll task state
    // For simplicity, we'll just check the task state periodically
    
    const checkInterval = setInterval(() => {
      const currentTask = this.teamCollaboration.getTask(task.id);
      if (!currentTask) {
        clearInterval(checkInterval);
        this.failNode(instanceId, nodeId, 'Task no longer exists');
        return;
      }
      
      if (currentTask.state === TaskState.COMPLETED) {
        clearInterval(checkInterval);
        
        const instance = this.workflowInstances.get(instanceId);
        if (!instance) {
          return;
        }
        
        const workflow = this.workflowDefinitions.get(instance.workflowId);
        if (!workflow) {
          return;
        }
        
        // Complete node
        this.completeNode(instanceId, nodeId, { result: currentTask.result });
        
        // Find outgoing edges
        const outgoingEdges = workflow.edges.filter(edge => edge.source === nodeId);
        
        // Activate next nodes
        for (const edge of outgoingEdges) {
          this.activateNode(instanceId, edge.target);
        }
        
        // Continue workflow execution
        this.executeWorkflowStep(instanceId);
      } else if (currentTask.state === TaskState.FAILED) {
        clearInterval(checkInterval);
        this.failNode(instanceId, nodeId, currentTask.error || 'Task failed');
      }
    }, 1000); // Check every second
  }

  /**
   * Activate a node
   */
  private activateNode(instanceId: string, nodeId: string): void {
    const instance = this.workflowInstances.get(instanceId);
    if (!instance) {
      return;
    }
    
    // Add to active nodes if not already present
    if (!instance.activeNodes.includes(nodeId) && !instance.completedNodes.includes(nodeId)) {
      const updatedInstance: WorkflowInstance = {
        ...instance,
        activeNodes: [...instance.activeNodes, nodeId],
      };
      
      this.workflowInstances.set(instanceId, updatedInstance);
      logger.debug(`Activated node ${nodeId} in workflow instance ${instanceId}`);
      
      // Continue workflow execution
      this.executeWorkflowStep(instanceId);
    }
  }

  /**
   * Complete a node
   */
  private completeNode(instanceId: string, nodeId: string, result: any): void {
    const instance = this.workflowInstances.get(instanceId);
    if (!instance) {
      return;
    }
    
    // Update instance
    const updatedInstance: WorkflowInstance = {
      ...instance,
      activeNodes: instance.activeNodes.filter(id => id !== nodeId),
      completedNodes: [...instance.completedNodes, nodeId],
      nodeResults: { ...instance.nodeResults, [nodeId]: result },
    };
    
    this.workflowInstances.set(instanceId, updatedInstance);
    logger.debug(`Completed node ${nodeId} in workflow instance ${instanceId}`);
  }

  /**
   * Fail a node
   */
  private failNode(instanceId: string, nodeId: string, error: string): void {
    const instance = this.workflowInstances.get(instanceId);
    if (!instance) {
      return;
    }
    
    // Update instance
    const updatedInstance: WorkflowInstance = {
      ...instance,
      activeNodes: instance.activeNodes.filter(id => id !== nodeId),
      state: WorkflowInstanceState.FAILED,
      error: `Error in node ${nodeId}: ${error}`,
      endTime: new Date(),
    };
    
    this.workflowInstances.set(instanceId, updatedInstance);
    logger.error(`Failed node ${nodeId} in workflow instance ${instanceId}: ${error}`);
    
    // Clear timeout if exists
    if (this.executionTimeouts.has(instanceId)) {
      clearTimeout(this.executionTimeouts.get(instanceId)!);
      this.executionTimeouts.delete(instanceId);
    }
  }

  /**
   * Complete a workflow
   */
  private completeWorkflow(instanceId: string): void {
    const instance = this.workflowInstances.get(instanceId);
    if (!instance) {
      return;
    }
    
    // Update instance
    const updatedInstance: WorkflowInstance = {
      ...instance,
      state: WorkflowInstanceState.COMPLETED,
      activeNodes: [],
      endTime: new Date(),
    };
    
    this.workflowInstances.set(instanceId, updatedInstance);
    logger.info(`Completed workflow instance ${instanceId}`);
    
    // Clear timeout if exists
    if (this.executionTimeouts.has(instanceId)) {
      clearTimeout(this.executionTimeouts.get(instanceId)!);
      this.executionTimeouts.delete(instanceId);
    }
  }

  /**
   * Handle workflow timeout
   */
  private handleWorkflowTimeout(instanceId: string): void {
    const instance = this.workflowInstances.get(instanceId);
    if (!instance || instance.state !== WorkflowInstanceState.RUNNING) {
      return;
    }
    
    // Update instance
    const updatedInstance: WorkflowInstance = {
      ...instance,
      state: WorkflowInstanceState.FAILED,
      error: 'Workflow execution timeout',
      endTime: new Date(),
    };
    
    this.workflowInstances.set(instanceId, updatedInstance);
    logger.error(`Workflow instance ${instanceId} timed out`);
    
    this.executionTimeouts.delete(instanceId);
  }

  /**
   * Check if workflow is complete
   */
  private checkWorkflowCompletion(instanceId: string): void {
    const instance = this.workflowInstances.get(instanceId);
    if (!instance || instance.state !== WorkflowInstanceState.RUNNING) {
      return;
    }
    
    // If no active nodes, check if END node is completed
    if (instance.activeNodes.length === 0) {
      const workflow = this.workflowDefinitions.get(instance.workflowId);
      if (!workflow) {
        return;
      }
      
      const endNode = workflow.nodes.find(node => node.type === WorkflowNodeType.END);
      if (!endNode) {
        return;
      }
      
      if (instance.completedNodes.includes(endNode.id)) {
        this.completeWorkflow(instanceId);
      } else {
        // If END node not reached but no active nodes, workflow is stuck
        this.failNode(instanceId, '', 'Workflow is stuck - no active nodes but END not reached');
      }
    }
  }

  /**
   * Get a workflow instance
   */
  public getWorkflowInstance(instanceId: string): WorkflowInstance | undefined {
    return this.workflowInstances.get(instanceId);
  }

  /**
   * Get all workflow instances
   */
  public getAllWorkflowInstances(): WorkflowInstance[] {
    return Array.from(this.workflowInstances.values());
  }

  /**
   * Cancel a workflow instance
   */
  public cancelWorkflowInstance(instanceId: string): boolean {
    const instance = this.workflowInstances.get(instanceId);
    if (!instance || instance.state !== WorkflowInstanceState.RUNNING) {
      return false;
    }
    
    // Update instance
    const updatedInstance: WorkflowInstance = {
      ...instance,
      state: WorkflowInstanceState.CANCELED,
      activeNodes: [],
      endTime: new Date(),
    };
    
    this.workflowInstances.set(instanceId, updatedInstance);
    logger.info(`Canceled workflow instance ${instanceId}`);
    
    // Clear timeout if exists
    if (this.executionTimeouts.has(instanceId)) {
      clearTimeout(this.executionTimeouts.get(instanceId)!);
      this.executionTimeouts.delete(instanceId);
    }
    
    return true;
  }
} 