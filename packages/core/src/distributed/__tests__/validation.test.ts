import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateDistributedSystem } from '../validation';
import { logger } from '../../utils/logger';
import { NodeManager } from '../node-manager';
import * as distributedSystem from '../distributed-system';
import { SystemStatus } from '../distributed-system';
import { TaskStatus, TaskPriority } from '../task-distributor';

// Define mock types
interface MockNodeManager {
  getActiveNodes: () => Promise<any[]>;
  validateNodeHealth: () => Promise<boolean>;
}

interface MockDistributedSystem {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getStatus: () => string;
  getActiveNodes: () => any[];
  getNode: (id: string) => any;
  submitTask: (type: string, data: any, constraints: any, priority: any) => Promise<string>;
  getTask: (id: string) => any;
  getStatistics: () => any;
  cancelTask: (id: string) => Promise<boolean>;
}

// Create mock implementations
const createMockSystem = (): MockDistributedSystem => ({
  start: () => Promise.resolve(),
  stop: () => Promise.resolve(),
  getStatus: () => distributedSystem.SystemStatus.RUNNING,
  getActiveNodes: () => [],
  getNode: () => null,
  submitTask: () => Promise.resolve('task-1'),
  getTask: () => ({ id: 'task-1', type: 'compute', status: 'PENDING' }),
  getStatistics: () => ({ totalTasks: 0, activeTasks: 0 }),
  cancelTask: () => Promise.resolve(true),
});

describe('Distributed System Validation', () => {
  let mockNodeManager: MockNodeManager;
  let mockSystem: MockDistributedSystem;
  let spyOnDistributedSystem: any;
  let retryCount = 0;

  beforeEach(() => {
    retryCount = 0;
    
    // Create mock instances
    mockNodeManager = {
      getActiveNodes: () => Promise.resolve([]),
      validateNodeHealth: () => Promise.resolve(true),
    };

    mockSystem = createMockSystem();
    
    // Mock DistributedSystem constructor
    spyOnDistributedSystem = vi.spyOn(distributedSystem, 'DistributedSystem').mockImplementation(() => mockSystem as any);

    // Mock NodeManager
    (NodeManager as any).getInstance = () => mockNodeManager;

    // Mock logger
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    // Mock timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should complete validation successfully', async () => {
    // Mock successful node discovery
    const nodes = [
      { id: 'node1', host: 'node-1', status: 'ACTIVE', currentLoad: { tasks: 0 } },
      { id: 'node2', host: 'node-2', status: 'ACTIVE', currentLoad: { tasks: 0 } },
      { id: 'node3', host: 'node-3', status: 'ACTIVE', currentLoad: { tasks: 0 } },
    ];
    
    mockSystem.getActiveNodes = () => nodes;
    mockSystem.getNode = (id) => nodes.find(n => n.id === id);

    const validationPromise = validateDistributedSystem();
    
    // Fast-forward timers
    await vi.advanceTimersByTimeAsync(2000); // Initial discovery wait
    await vi.advanceTimersByTimeAsync(1000); // Additional operations

    await validationPromise;

    expect(spyOnDistributedSystem).toHaveBeenCalledTimes(3);
    expect(logger.info).toHaveBeenCalledWith('Distributed system validation completed successfully');
  });

  it('should handle validation failures gracefully', async () => {
    // Mock system failure
    const error = new Error('Simulated system failure');
    mockSystem.start = () => Promise.reject(error);

    await expect(validateDistributedSystem()).rejects.toThrow('Simulated system failure');
    expect(logger.error).toHaveBeenCalledWith('Validation failed:', error);
  });

  it('should retry node discovery on failure', async () => {
    // Mock failed attempts followed by success
    const nodes = [
      { id: 'node1', host: 'node-1', status: 'ACTIVE', currentLoad: { tasks: 0 } },
      { id: 'node2', host: 'node-2', status: 'ACTIVE', currentLoad: { tasks: 0 } },
      { id: 'node3', host: 'node-3', status: 'ACTIVE', currentLoad: { tasks: 0 } },
    ];

    let retryAttempt = 0;
    mockSystem.getActiveNodes = () => {
      // Each validation attempt will call getActiveNodes multiple times
      // Return incomplete node list for first two attempts
      const result = retryAttempt < 2 ? [nodes[0]] : nodes;
      retryAttempt++;
      return result;
    };
    
    mockSystem.getNode = (id) => nodes.find(n => n.id === id);

    const validationPromise = validateDistributedSystem();
    
    // Fast-forward timers
    await vi.advanceTimersByTimeAsync(2000); // Initial discovery wait
    await vi.advanceTimersByTimeAsync(1000); // First retry
    await vi.advanceTimersByTimeAsync(1000); // Second retry

    await validationPromise;

    expect(logger.warn).toHaveBeenCalledWith('Node discovery retry 1/3');
    expect(logger.warn).toHaveBeenCalledWith('Node discovery retry 2/3');
    expect(logger.info).toHaveBeenCalledWith('Node discovery validation successful');
  });

  it('should fail after max retries', async () => {
    // Mock consistent failures
    mockSystem.getActiveNodes = () => [{ id: 'node1', host: 'node-1', status: 'ACTIVE', currentLoad: { tasks: 0 } }];
    mockSystem.getNode = (id) => ({ id, host: 'node-1', status: 'ACTIVE', currentLoad: { tasks: 0 } });

    const validationPromise = validateDistributedSystem();

    // Fast-forward timers
    await vi.advanceTimersByTimeAsync(2000); // Initial discovery wait
    await vi.advanceTimersByTimeAsync(1000); // First retry
    await vi.advanceTimersByTimeAsync(1000); // Second retry
    await vi.advanceTimersByTimeAsync(1000); // Third retry

    await expect(validationPromise).rejects.toThrow('Node discovery validation failed after retries');

    expect(logger.warn).toHaveBeenCalledWith('Node discovery retry 1/3');
    expect(logger.warn).toHaveBeenCalledWith('Node discovery retry 2/3');
    expect(logger.error).toHaveBeenCalledWith('Validation failed:', expect.any(Error));
  });

  it('should validate distributed task execution', async () => {
    // Mock successful node discovery
    const nodes = [
      { id: 'node1', host: 'node-1', status: 'ACTIVE', currentLoad: { tasks: 0 }, capabilities: { supportedTaskTypes: ['compute'] } },
      { id: 'node2', host: 'node-2', status: 'ACTIVE', currentLoad: { tasks: 0 }, capabilities: { supportedTaskTypes: ['io'] } },
    ];
    
    mockSystem.getActiveNodes = () => nodes;
    mockSystem.getNode = (id) => nodes.find(n => n.id === id);

    // Mock task submission and execution
    let taskCounter = 0;
    const tasks = new Map();
    
    mockSystem.submitTask = async (type, data, constraints) => {
      const taskId = `task-${++taskCounter}`;
      const task = {
        id: taskId,
        type,
        status: TaskStatus.PENDING,
        assignedNodes: [],
        data,
        constraints
      };
      tasks.set(taskId, task);
      return taskId;
    };

    mockSystem.getTask = (id) => tasks.get(id);

    const validationPromise = validateDistributedSystem();
    
    // Fast-forward timers for initial setup
    await vi.advanceTimersByTimeAsync(2000);

    // Simulate task execution
    tasks.forEach(task => {
      task.status = TaskStatus.RUNNING;
      task.assignedNodes = [nodes[0].id];
    });

    await vi.advanceTimersByTimeAsync(1000);

    // Complete tasks
    tasks.forEach(task => {
      task.status = TaskStatus.COMPLETED;
    });

    await validationPromise;

    expect(logger.info).toHaveBeenCalledWith('Distributed system validation completed successfully');
    expect(tasks.size).toBeGreaterThan(0);
  });

  it('should handle node failures gracefully', async () => {
    // Mock initial node discovery
    const nodes = [
      { id: 'node1', host: 'node-1', status: 'ACTIVE', currentLoad: { tasks: 0 } },
      { id: 'node2', host: 'node-2', status: 'ACTIVE', currentLoad: { tasks: 0 } },
      { id: 'node3', host: 'node-3', status: 'ACTIVE', currentLoad: { tasks: 0 } },
    ];
    
    mockSystem.getActiveNodes = () => nodes;
    mockSystem.getNode = (id) => nodes.find(n => n.id === id);

    const tasks = new Map();
    let taskCounter = 0;

    mockSystem.submitTask = async (type, data) => {
      const taskId = `task-${++taskCounter}`;
      const task = {
        id: taskId,
        type,
        status: TaskStatus.PENDING,
        assignedNodes: [],
        data
      };
      tasks.set(taskId, task);
      return taskId;
    };

    mockSystem.getTask = (id) => tasks.get(id);

    const validationPromise = validateDistributedSystem();
    
    // Initial setup
    await vi.advanceTimersByTimeAsync(2000);

    // Simulate node failure
    nodes[1].status = 'ERROR';
    
    // Simulate task reassignment
    tasks.forEach(task => {
      if (task.assignedNodes.includes(nodes[1].id)) {
        task.assignedNodes = [nodes[0].id];
        task.status = TaskStatus.RUNNING;
      }
    });

    await vi.advanceTimersByTimeAsync(1000);

    // Complete remaining tasks
    tasks.forEach(task => {
      if (task.status !== TaskStatus.FAILED) {
        task.status = TaskStatus.COMPLETED;
      }
    });

    await validationPromise;

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Node discovery retry'));
    expect(logger.info).toHaveBeenCalledWith('Distributed system validation completed successfully');
  });

  it('should validate load balancing', async () => {
    // Mock nodes with different loads
    const nodes = [
      { 
        id: 'node1', 
        host: 'node-1', 
        status: 'ACTIVE', 
        currentLoad: { tasks: 2, cpu: 60, memory: 4096 },
        capabilities: { 
          maxConcurrentTasks: 5,
          resources: { cpu: 100, memory: 8192 }
        }
      },
      { 
        id: 'node2', 
        host: 'node-2', 
        status: 'ACTIVE', 
        currentLoad: { tasks: 1, cpu: 30, memory: 2048 },
        capabilities: { 
          maxConcurrentTasks: 5,
          resources: { cpu: 100, memory: 8192 }
        }
      },
      { 
        id: 'node3', 
        host: 'node-3', 
        status: 'ACTIVE', 
        currentLoad: { tasks: 0, cpu: 10, memory: 1024 },
        capabilities: { 
          maxConcurrentTasks: 5,
          resources: { cpu: 100, memory: 8192 }
        }
      }
    ];
    
    mockSystem.getActiveNodes = () => nodes;
    mockSystem.getNode = (id) => nodes.find(n => n.id === id);

    const tasks = new Map();
    let taskCounter = 0;

    mockSystem.submitTask = async (type, data, constraints, priority) => {
      const taskId = `task-${++taskCounter}`;
      const task = {
        id: taskId,
        type,
        status: TaskStatus.PENDING,
        assignedNodes: [],
        data,
        priority
      };
      tasks.set(taskId, task);
      return taskId;
    };

    mockSystem.getTask = (id) => tasks.get(id);

    mockSystem.getStatistics = () => ({
      nodes: {
        total: nodes.length,
        active: nodes.filter(n => n.status === 'ACTIVE').length
      },
      tasks: {
        total: tasks.size,
        running: Array.from(tasks.values()).filter(t => t.status === TaskStatus.RUNNING).length
      },
      resources: {
        totalCpu: nodes.reduce((sum, n) => sum + n.capabilities.resources.cpu, 0),
        usedCpu: nodes.reduce((sum, n) => sum + n.currentLoad.cpu, 0),
        totalMemory: nodes.reduce((sum, n) => sum + n.capabilities.resources.memory, 0),
        usedMemory: nodes.reduce((sum, n) => sum + n.currentLoad.memory, 0)
      }
    });

    const validationPromise = validateDistributedSystem();
    
    // Initial setup
    await vi.advanceTimersByTimeAsync(2000);

    // Simulate task assignments based on load
    tasks.forEach(task => {
      // Assign to least loaded node (node3)
      task.assignedNodes = ['node3'];
      task.status = TaskStatus.RUNNING;
      
      // Update node load
      const node = nodes.find(n => n.id === 'node3');
      if (node) {
        node.currentLoad.tasks++;
        node.currentLoad.cpu += 20;
        node.currentLoad.memory += 1024;
      }
    });

    await vi.advanceTimersByTimeAsync(1000);

    // Complete tasks
    tasks.forEach(task => {
      task.status = TaskStatus.COMPLETED;
    });

    await validationPromise;

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('System Statistics'));
    expect(logger.info).toHaveBeenCalledWith('Distributed system validation completed successfully');
  });
}); 