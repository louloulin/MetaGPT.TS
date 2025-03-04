/**
 * @module DistributedSystem
 * @category Distributed
 * 
 * High-level distributed system manager
 */

import { EventEmitter } from 'events';
import { MessageBroker, MessageType, MessagePriority, type Message } from './message-broker';
import { NodeManager, NodeStatus, type NodeInfo, type NodeCapabilities } from './node-manager';
import { TaskDistributor, TaskStatus, TaskPriority, type Task, type TaskRequirements } from './task-distributor';
import { logger } from '../utils/logger';

/**
 * Distributed system options interface
 */
export interface DistributedSystemOptions {
  nodeInfo?: Partial<NodeInfo>;
  messageBroker?: {
    maxRetries?: number;
    retryDelay?: number;
    defaultTTL?: number;
    maxQueueSize?: number;
    enablePersistence?: boolean;
  };
  nodeManager?: {
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
    cleanupInterval?: number;
    discoveryBroadcastInterval?: number;
  };
  taskDistributor?: {
    maxRetries?: number;
    defaultTimeout?: number;
    retryDelay?: number;
    taskCleanupInterval?: number;
    loadBalancingStrategy?: 'round-robin' | 'least-loaded' | 'random';
  };
}

/**
 * System status enum
 */
export enum SystemStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  DRAINING = 'draining',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * High-level distributed system manager
 */
export class DistributedSystem extends EventEmitter {
  private messageBroker: MessageBroker;
  private nodeManager: NodeManager;
  private taskDistributor: TaskDistributor;
  private status: SystemStatus;

  constructor(options: DistributedSystemOptions = {}) {
    super();
    
    // Initialize components
    this.messageBroker = new MessageBroker(options.messageBroker);
    this.nodeManager = new NodeManager(
      this.messageBroker,
      options.nodeInfo ?? {},
      options.nodeManager
    );
    this.taskDistributor = new TaskDistributor(
      this.messageBroker,
      this.nodeManager,
      options.taskDistributor
    );

    this.status = SystemStatus.STARTING;

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Node events
    this.nodeManager.on('nodeAdded', (node: NodeInfo) => {
      this.emit('nodeAdded', node);
    });

    this.nodeManager.on('nodeUpdated', (node: NodeInfo) => {
      this.emit('nodeUpdated', node);
    });

    this.nodeManager.on('nodeRemoved', (node: NodeInfo) => {
      this.emit('nodeRemoved', node);
    });

    // Task events
    this.taskDistributor.on('taskSubmitted', (task: Task) => {
      this.emit('taskSubmitted', task);
    });

    this.taskDistributor.on('taskAssigned', (task: Task) => {
      this.emit('taskAssigned', task);
    });

    this.taskDistributor.on('taskCompleted', (task: Task) => {
      this.emit('taskCompleted', task);
    });

    this.taskDistributor.on('taskFailed', (task: Task) => {
      this.emit('taskFailed', task);
    });

    this.taskDistributor.on('taskCancelled', (task: Task) => {
      this.emit('taskCancelled', task);
    });
  }

  /**
   * Start the distributed system
   */
  public async start(): Promise<void> {
    try {
      logger.info('[DistributedSystem] Starting system...');

      // Update node status to ACTIVE
      await this.nodeManager.updateStatus(NodeStatus.ACTIVE);
      this.status = SystemStatus.RUNNING;

      logger.info('[DistributedSystem] System started successfully');
      this.emit('started');
    } catch (error) {
      logger.error(`[DistributedSystem] Failed to start system: ${(error as Error).message}`);
      this.status = SystemStatus.ERROR;
      throw error;
    }
  }

  /**
   * Stop the distributed system
   */
  public async stop(): Promise<void> {
    try {
      logger.info('[DistributedSystem] Stopping system...');

      // Set status to draining to stop accepting new tasks
      this.status = SystemStatus.DRAINING;
      await this.nodeManager.updateStatus(NodeStatus.DRAINING);

      // Wait for running tasks to complete
      const runningTasks = this.taskDistributor.getTasks().filter(
        task => task.status === TaskStatus.RUNNING
      );

      if (runningTasks.length > 0) {
        logger.info(`[DistributedSystem] Waiting for ${runningTasks.length} tasks to complete...`);
        await Promise.all(runningTasks.map(task =>
          new Promise(resolve => {
            const checkTask = () => {
              const currentTask = this.taskDistributor.getTask(task.id);
              if (currentTask?.status !== TaskStatus.RUNNING) {
                resolve(undefined);
              }
            };
            const interval = setInterval(checkTask, 1000);
            setTimeout(() => {
              clearInterval(interval);
              resolve(undefined);
            }, 30000); // 30 second timeout
          })
        ));
      }

      // Clean up resources
      this.taskDistributor.cleanup();
      this.nodeManager.cleanup();
      this.messageBroker.clear();

      this.status = SystemStatus.STOPPED;
      logger.info('[DistributedSystem] System stopped successfully');
      this.emit('stopped');
    } catch (error) {
      logger.error(`[DistributedSystem] Failed to stop system: ${(error as Error).message}`);
      this.status = SystemStatus.ERROR;
      throw error;
    }
  }

  /**
   * Submit a task to the system
   */
  public async submitTask(
    type: string,
    payload: any,
    requirements: TaskRequirements = {},
    priority: TaskPriority = TaskPriority.NORMAL
  ): Promise<string> {
    if (this.status !== SystemStatus.RUNNING) {
      throw new Error('System is not running');
    }
    return this.taskDistributor.submitTask(type, payload, requirements, priority);
  }

  /**
   * Get task by ID
   */
  public getTask(taskId: string): Task | undefined {
    return this.taskDistributor.getTask(taskId);
  }

  /**
   * Get all tasks
   */
  public getTasks(): Task[] {
    return this.taskDistributor.getTasks();
  }

  /**
   * Cancel a task
   */
  public async cancelTask(taskId: string): Promise<boolean> {
    return this.taskDistributor.cancelTask(taskId);
  }

  /**
   * Get node by ID
   */
  public getNode(nodeId: string): NodeInfo | undefined {
    return this.nodeManager.getNode(nodeId);
  }

  /**
   * Get all active nodes
   */
  public getActiveNodes(): NodeInfo[] {
    return this.nodeManager.getActiveNodes();
  }

  /**
   * Find nodes by capabilities
   */
  public findNodesByCapabilities(requirements: Partial<NodeCapabilities>): NodeInfo[] {
    return this.nodeManager.findNodesByCapabilities(requirements);
  }

  /**
   * Get system status
   */
  public getStatus(): SystemStatus {
    return this.status;
  }

  /**
   * Get system statistics
   */
  public getStatistics(): any {
    const nodes = this.getActiveNodes();
    const tasks = this.getTasks();

    return {
      nodes: {
        total: nodes.length,
        active: nodes.filter(n => n.status === NodeStatus.ACTIVE).length,
        busy: nodes.filter(n => n.status === NodeStatus.BUSY).length,
        draining: nodes.filter(n => n.status === NodeStatus.DRAINING).length,
        inactive: nodes.filter(n => n.status === NodeStatus.INACTIVE).length,
        error: nodes.filter(n => n.status === NodeStatus.ERROR).length
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === TaskStatus.PENDING).length,
        assigned: tasks.filter(t => t.status === TaskStatus.ASSIGNED).length,
        running: tasks.filter(t => t.status === TaskStatus.RUNNING).length,
        completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
        failed: tasks.filter(t => t.status === TaskStatus.FAILED).length,
        cancelled: tasks.filter(t => t.status === TaskStatus.CANCELLED).length
      },
      resources: {
        totalCpu: nodes.reduce((sum, n) => sum + n.capabilities.resources.cpu, 0),
        usedCpu: nodes.reduce((sum, n) => sum + n.currentLoad.cpu, 0),
        totalMemory: nodes.reduce((sum, n) => sum + n.capabilities.resources.memory, 0),
        usedMemory: nodes.reduce((sum, n) => sum + n.currentLoad.memory, 0),
        totalGpu: nodes.reduce((sum, n) => sum + (n.capabilities.resources.gpu ?? 0), 0),
        usedGpu: nodes.reduce((sum, n) => sum + (n.currentLoad.gpu ?? 0), 0)
      }
    };
  }
} 