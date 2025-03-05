import { DistributedSystem, SystemStatus } from '../distributed-system';
import { NodeStatus } from '../node-manager';
import { TaskStatus, TaskPriority } from '../task-distributor';

jest.useFakeTimers();

describe('DistributedSystem', () => {
  let system: DistributedSystem;

  beforeEach(() => {
    system = new DistributedSystem({
      nodeInfo: {
        host: 'test-host',
        port: 8080,
        capabilities: {
          maxConcurrentTasks: 5,
          supportedTaskTypes: ['test'],
          resources: {
            cpu: 4,
            memory: 8192,
            gpu: 1
          }
        }
      }
    });
  });

  afterEach(async () => {
    await system.stop();
  });

  describe('system lifecycle', () => {
    it('should start and stop correctly', async () => {
      const startPromise = new Promise(resolve => system.once('started', resolve));
      await system.start();
      await startPromise;

      expect(system.getStatus()).toBe(SystemStatus.RUNNING);
      expect(system.getActiveNodes()).toHaveLength(1);
      expect(system.getActiveNodes()[0].status).toBe(NodeStatus.ACTIVE);

      const stopPromise = new Promise(resolve => system.once('stopped', resolve));
      await system.stop();
      await stopPromise;

      expect(system.getStatus()).toBe(SystemStatus.STOPPED);
      expect(system.getActiveNodes()).toHaveLength(0);
    });

    it('should handle graceful shutdown with running tasks', async () => {
      await system.start();

      // Submit a task
      const taskId = await system.submitTask('test', { data: 'test' });
      expect(system.getTask(taskId)?.status).toBe(TaskStatus.ASSIGNED);

      // Start stopping the system
      const stopPromise = system.stop();
      expect(system.getStatus()).toBe(SystemStatus.DRAINING);

      // Wait for stop to complete
      await stopPromise;
      expect(system.getStatus()).toBe(SystemStatus.STOPPED);
    });
  });

  describe('task management', () => {
    beforeEach(async () => {
      await system.start();
    });

    it('should submit and track tasks', async () => {
      const taskSubmittedPromise = new Promise(resolve => system.once('taskSubmitted', resolve));
      const taskAssignedPromise = new Promise(resolve => system.once('taskAssigned', resolve));

      const taskId = await system.submitTask('test', { data: 'test' });
      
      await taskSubmittedPromise;
      await taskAssignedPromise;

      const task = system.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.type).toBe('test');
      expect(task?.payload).toEqual({ data: 'test' });
      expect(task?.status).toBe(TaskStatus.ASSIGNED);
    });

    it('should handle task priorities', async () => {
      const lowPriorityId = await system.submitTask('test', { priority: 'low' }, {}, TaskPriority.LOW);
      const highPriorityId = await system.submitTask('test', { priority: 'high' }, {}, TaskPriority.HIGH);

      const lowPriorityTask = system.getTask(lowPriorityId);
      const highPriorityTask = system.getTask(highPriorityId);

      expect(lowPriorityTask?.priority).toBe(TaskPriority.LOW);
      expect(highPriorityTask?.priority).toBe(TaskPriority.HIGH);
    });

    it('should cancel tasks', async () => {
      const taskId = await system.submitTask('test', { data: 'test' });
      const task = system.getTask(taskId);
      expect(task?.status).toBe(TaskStatus.ASSIGNED);

      const cancelPromise = new Promise(resolve => system.once('taskCancelled', resolve));
      const cancelled = await system.cancelTask(taskId);
      await cancelPromise;

      expect(cancelled).toBe(true);
      expect(system.getTask(taskId)?.status).toBe(TaskStatus.CANCELLED);
    });

    it('should reject task submission when system is not running', async () => {
      await system.stop();
      await expect(system.submitTask('test', { data: 'test' }))
        .rejects.toThrow('System is not running');
    });
  });

  describe('node management', () => {
    beforeEach(async () => {
      await system.start();
    });

    it('should track active nodes', () => {
      const nodes = system.getActiveNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].status).toBe(NodeStatus.ACTIVE);
    });

    it('should find nodes by capabilities', () => {
      const nodes = system.findNodesByCapabilities({
        supportedTaskTypes: ['test'],
        resources: {
          cpu: 2,
          memory: 4096
        }
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].capabilities.supportedTaskTypes).toContain('test');
      expect(nodes[0].capabilities.resources.cpu).toBeGreaterThanOrEqual(2);
      expect(nodes[0].capabilities.resources.memory).toBeGreaterThanOrEqual(4096);
    });
  });

  describe('system statistics', () => {
    beforeEach(async () => {
      await system.start();
    });

    it('should provide system statistics', async () => {
      // Submit some tasks
      await system.submitTask('test', { data: '1' });
      await system.submitTask('test', { data: '2' });
      const failedTaskId = await system.submitTask('test', { data: '3' });
      await system.cancelTask(failedTaskId);

      const stats = system.getStatistics();

      expect(stats.nodes.total).toBe(1);
      expect(stats.nodes.active).toBe(1);

      expect(stats.tasks.total).toBe(3);
      expect(stats.tasks.assigned).toBeGreaterThan(0);
      expect(stats.tasks.cancelled).toBe(1);

      expect(stats.resources.totalCpu).toBe(4);
      expect(stats.resources.totalMemory).toBe(8192);
      expect(stats.resources.totalGpu).toBe(1);
    });
  });
}); 