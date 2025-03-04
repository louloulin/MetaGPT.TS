/**
 * @module TaskDistributor
 * @category Distributed
 * 
 * Task distribution and management for distributed system
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MessageBroker, MessageType, MessagePriority, type Message } from './message-broker';
import { NodeManager, NodeStatus, type NodeInfo, type NodeCapabilities } from './node-manager';
import { logger } from '../utils/logger';

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Task priority enum
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Task requirements interface
 */
export interface TaskRequirements extends Partial<NodeCapabilities> {
  minNodes?: number;
  maxNodes?: number;
  preferredNodes?: string[];
  excludedNodes?: string[];
  timeout?: number;
}

/**
 * Task definition interface
 */
export interface Task {
  id: string;
  type: string;
  payload: any;
  status: TaskStatus;
  priority: TaskPriority;
  requirements: TaskRequirements;
  assignedNodes: string[];
  result?: any;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  timeout?: number;
  retries: number;
  maxRetries: number;
}

/**
 * Task distributor options interface
 */
export interface TaskDistributorOptions {
  maxRetries?: number;
  defaultTimeout?: number;
  retryDelay?: number;
  taskCleanupInterval?: number;
  loadBalancingStrategy?: 'round-robin' | 'least-loaded' | 'random';
}

/**
 * Task distributor for distributed system
 */
export class TaskDistributor extends EventEmitter {
  private tasks: Map<string, Task>;
  private messageBroker: MessageBroker;
  private nodeManager: NodeManager;
  private options: Required<TaskDistributorOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    messageBroker: MessageBroker,
    nodeManager: NodeManager,
    options: TaskDistributorOptions = {}
  ) {
    super();
    this.tasks = new Map();
    this.messageBroker = messageBroker;
    this.nodeManager = nodeManager;

    // Set default options
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      defaultTimeout: options.defaultTimeout ?? 300000, // 5 minutes
      retryDelay: options.retryDelay ?? 5000,
      taskCleanupInterval: options.taskCleanupInterval ?? 60000,
      loadBalancingStrategy: options.loadBalancingStrategy ?? 'least-loaded'
    };

    // Subscribe to task-related messages
    this.setupMessageHandlers();

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Set up message handlers
   */
  private setupMessageHandlers(): void {
    // Handle task result messages
    this.messageBroker.subscribe(MessageType.TASK_RESULT, async (message: Message) => {
      const { taskId, nodeId, result, error } = message.payload;
      await this.handleTaskResult(taskId, nodeId, result, error);
    });
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupTasks();
    }, this.options.taskCleanupInterval);
  }

  /**
   * Clean up completed and failed tasks
   */
  private cleanupTasks(): void {
    const now = Date.now();
    for (const [taskId, task] of this.tasks.entries()) {
      // Remove completed tasks after 1 hour
      if (task.status === TaskStatus.COMPLETED && task.completedAt &&
          now - task.completedAt > 3600000) {
        this.tasks.delete(taskId);
        continue;
      }

      // Remove failed tasks after 24 hours
      if (task.status === TaskStatus.FAILED && task.completedAt &&
          now - task.completedAt > 86400000) {
        this.tasks.delete(taskId);
        continue;
      }

      // Check for timed out tasks
      if (task.status === TaskStatus.RUNNING && task.startedAt &&
          task.timeout && now - task.startedAt > task.timeout) {
        this.handleTaskTimeout(task);
      }
    }
  }

  /**
   * Submit a new task
   */
  public async submitTask(
    type: string,
    payload: any,
    requirements: TaskRequirements = {},
    priority: TaskPriority = TaskPriority.NORMAL
  ): Promise<string> {
    const task: Task = {
      id: uuidv4(),
      type,
      payload,
      status: TaskStatus.PENDING,
      priority,
      requirements: {
        ...requirements,
        minNodes: requirements.minNodes ?? 1,
        maxNodes: requirements.maxNodes ?? 1
      },
      assignedNodes: [],
      createdAt: Date.now(),
      retries: 0,
      maxRetries: requirements.maxRetries ?? this.options.maxRetries,
      timeout: requirements.timeout ?? this.options.defaultTimeout
    };

    this.tasks.set(task.id, task);
    this.emit('taskSubmitted', task);

    // Try to assign the task immediately
    await this.assignTask(task);

    return task.id;
  }

  /**
   * Assign a task to available nodes
   */
  private async assignTask(task: Task): Promise<boolean> {
    // Find eligible nodes
    const eligibleNodes = this.nodeManager.findNodesByCapabilities(task.requirements);

    // Filter out excluded nodes
    const availableNodes = eligibleNodes.filter(node =>
      !task.requirements.excludedNodes?.includes(node.id) &&
      node.status === NodeStatus.ACTIVE
    );

    // Check if we have enough nodes
    if (availableNodes.length < (task.requirements.minNodes ?? 1)) {
      logger.warn(`[TaskDistributor] Not enough nodes available for task ${task.id}`);
      return false;
    }

    // Sort nodes based on load balancing strategy
    const selectedNodes = this.selectNodes(
      availableNodes,
      task.requirements.minNodes ?? 1,
      task.requirements.maxNodes ?? 1,
      task.requirements.preferredNodes
    );

    // Assign task to selected nodes
    task.status = TaskStatus.ASSIGNED;
    task.assignedNodes = selectedNodes.map(node => node.id);

    // Send task assignment messages
    await Promise.all(selectedNodes.map(node =>
      this.messageBroker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'task_distributor',
        recipient: node.id,
        priority: task.priority,
        payload: {
          taskId: task.id,
          type: task.type,
          payload: task.payload
        }
      })
    ));

    this.emit('taskAssigned', task);
    return true;
  }

  /**
   * Select nodes based on load balancing strategy
   */
  private selectNodes(
    nodes: NodeInfo[],
    minNodes: number,
    maxNodes: number,
    preferredNodes?: string[]
  ): NodeInfo[] {
    let selectedNodes = [...nodes];

    // Prioritize preferred nodes
    if (preferredNodes?.length) {
      selectedNodes.sort((a, b) =>
        (preferredNodes.includes(b.id) ? 1 : 0) -
        (preferredNodes.includes(a.id) ? 1 : 0)
      );
    }

    // Apply load balancing strategy
    switch (this.options.loadBalancingStrategy) {
      case 'least-loaded':
        selectedNodes.sort((a, b) =>
          (a.currentLoad.tasks / a.capabilities.maxConcurrentTasks) -
          (b.currentLoad.tasks / b.capabilities.maxConcurrentTasks)
        );
        break;
      case 'random':
        for (let i = selectedNodes.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [selectedNodes[i], selectedNodes[j]] = [selectedNodes[j], selectedNodes[i]];
        }
        break;
      // round-robin is handled by the natural order of nodes
    }

    return selectedNodes.slice(0, maxNodes);
  }

  /**
   * Handle task result
   */
  private async handleTaskResult(
    taskId: string,
    nodeId: string,
    result?: any,
    error?: string
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`[TaskDistributor] Received result for unknown task ${taskId}`);
      return;
    }

    if (error) {
      // Handle task failure
      if (task.retries < task.maxRetries) {
        // Retry the task
        task.retries++;
        task.status = TaskStatus.PENDING;
        task.assignedNodes = [];
        logger.warn(`[TaskDistributor] Retrying task ${taskId} (attempt ${task.retries})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
        await this.assignTask(task);
      } else {
        // Mark task as failed
        task.status = TaskStatus.FAILED;
        task.error = error;
        task.completedAt = Date.now();
        this.emit('taskFailed', task);
      }
    } else {
      // Mark task as completed
      task.status = TaskStatus.COMPLETED;
      task.result = result;
      task.completedAt = Date.now();
      this.emit('taskCompleted', task);
    }
  }

  /**
   * Handle task timeout
   */
  private async handleTaskTimeout(task: Task): Promise<void> {
    logger.warn(`[TaskDistributor] Task ${task.id} timed out`);

    if (task.retries < task.maxRetries) {
      // Retry the task
      task.retries++;
      task.status = TaskStatus.PENDING;
      task.assignedNodes = [];
      task.startedAt = undefined;
      
      logger.warn(`[TaskDistributor] Retrying task ${task.id} (attempt ${task.retries})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
      await this.assignTask(task);
    } else {
      // Mark task as failed
      task.status = TaskStatus.FAILED;
      task.error = 'Task timed out';
      task.completedAt = Date.now();
      this.emit('taskFailed', task);
    }
  }

  /**
   * Get task by ID
   */
  public getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  public getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Cancel a task
   */
  public async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = TaskStatus.CANCELLED;
    task.completedAt = Date.now();

    // Notify assigned nodes
    await Promise.all(task.assignedNodes.map(nodeId =>
      this.messageBroker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'task_distributor',
        recipient: nodeId,
        priority: TaskPriority.HIGH,
        payload: {
          taskId: task.id,
          cancelled: true
        }
      })
    ));

    this.emit('taskCancelled', task);
    return true;
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.tasks.clear();
    this.removeAllListeners();
  }
} 