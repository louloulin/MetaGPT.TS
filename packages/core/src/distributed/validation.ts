/**
 * @module validation
 * @category Distributed
 * 
 * Distributed system validation script
 */

import { DistributedSystem, SystemStatus } from './distributed-system';
import { NodeStatus } from './node-manager';
import { TaskStatus, TaskPriority } from './task-distributor';
import { logger } from '../utils/logger';

async function validateDistributedSystem() {
  logger.info('Starting distributed system validation...');

  // Create multiple system instances to simulate a distributed environment
  const systems: DistributedSystem[] = [];
  
  try {
    // Initialize systems with different configurations
    const systemConfigs = [
      {
        nodeInfo: {
          host: 'node-1',
          port: 8081,
          capabilities: {
            maxConcurrentTasks: 5,
            supportedTaskTypes: ['compute', 'io'],
            resources: { cpu: 4, memory: 8192, gpu: 2 }
          }
        }
      },
      {
        nodeInfo: {
          host: 'node-2',
          port: 8082,
          capabilities: {
            maxConcurrentTasks: 3,
            supportedTaskTypes: ['compute'],
            resources: { cpu: 2, memory: 4096 }
          }
        }
      },
      {
        nodeInfo: {
          host: 'node-3',
          port: 8083,
          capabilities: {
            maxConcurrentTasks: 2,
            supportedTaskTypes: ['io'],
            resources: { cpu: 1, memory: 2048 }
          }
        }
      }
    ];

    // Start all systems
    for (const config of systemConfigs) {
      const system = new DistributedSystem(config);
      await system.start();
      systems.push(system);
      logger.info(`Started system on ${config.nodeInfo.host}`);
    }

    // Wait for node discovery
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Validate node discovery
    let discoverySuccess = false;
    let retries = 0;
    const maxRetries = 3;

    while (!discoverySuccess && retries < maxRetries) {
      try {
        for (const system of systems) {
          const nodes = system.getActiveNodes();
          logger.info(`System ${system.getNode(system.getActiveNodes()[0].id)?.host} sees ${nodes.length} nodes`);
          if (nodes.length !== systems.length) {
            throw new Error('Node discovery incomplete');
          }
        }
        discoverySuccess = true;
        logger.info('Node discovery validation successful');
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error('Node discovery validation failed after retries');
        }
        logger.warn(`Node discovery retry ${retries}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Submit tasks to test distribution
    const mainSystem = systems[0];
    const taskResults: Array<{ id: string; type: string }> = [];

    // Test compute tasks
    const computeTaskIds = await Promise.all([
      mainSystem.submitTask('compute', { operation: 'matrix_multiply', size: 1000 }, 
        { supportedTaskTypes: ['compute'] }, TaskPriority.HIGH),
      mainSystem.submitTask('compute', { operation: 'matrix_multiply', size: 500 },
        { supportedTaskTypes: ['compute'] }, TaskPriority.NORMAL)
    ]);

    // Test IO tasks
    const ioTaskIds = await Promise.all([
      mainSystem.submitTask('io', { operation: 'file_process', size: '1GB' },
        { supportedTaskTypes: ['io'] }, TaskPriority.NORMAL),
      mainSystem.submitTask('io', { operation: 'file_process', size: '500MB' },
        { supportedTaskTypes: ['io'] }, TaskPriority.LOW)
    ]);

    // Monitor task distribution
    const allTaskIds = [...computeTaskIds, ...ioTaskIds];
    for (const taskId of allTaskIds) {
      const task = mainSystem.getTask(taskId);
      if (!task) continue;
      
      taskResults.push({
        id: taskId,
        type: task.type
      });
      
      logger.info(`Task ${taskId} (${task.type}) submitted with status ${task.status}`);
    }

    // Validate task assignment
    const stats = mainSystem.getStatistics();
    logger.info('System Statistics:', stats);

    // Validate node capabilities and load balancing
    for (const system of systems) {
      const nodes = system.getActiveNodes();
      for (const node of nodes) {
        logger.info(`Node ${node.host} status: ${node.status}, tasks: ${node.currentLoad.tasks}`);
      }
    }

    // Test task cancellation
    const taskToCancel = taskResults[taskResults.length - 1];
    const cancelled = await mainSystem.cancelTask(taskToCancel.id);
    logger.info(`Task ${taskToCancel.id} cancellation result: ${cancelled}`);

    // Validate graceful shutdown
    logger.info('Starting graceful shutdown...');
    await Promise.all(systems.map(system => system.stop()));
    logger.info('All systems stopped successfully');

    logger.info('Distributed system validation completed successfully');
  } catch (error) {
    logger.error('Validation failed:', error);
    throw error;
  } finally {
    // Cleanup
    for (const system of systems) {
      if (system.getStatus() !== SystemStatus.STOPPED) {
        await system.stop().catch(err => logger.error('Cleanup error:', err));
      }
    }
  }
}

// Export for testing
export { validateDistributedSystem };

// Run validation if this is the main module
if (require.main === module) {
  validateDistributedSystem().catch(error => {
    logger.error('Validation script failed:', error);
    process.exit(1);
  });
} 