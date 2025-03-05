/**
 * Distributed Computing Example
 * 
 * This example demonstrates how to use the distributed system for:
 * 1. Matrix operations (multiplication, addition)
 * 2. Large data processing
 * 3. Load balancing and fault tolerance
 */

import { DistributedSystem, SystemStatus } from '../src/distributed/distributed-system';
import { TaskPriority } from '../src/distributed/task-distributor';
import { logger } from '../src/utils/logger';

interface MatrixTask {
  operation: 'multiply' | 'add';
  matrices: number[][][];
}

interface DataProcessingTask {
  operation: 'filter' | 'transform' | 'aggregate';
  data: any[];
  parameters: Record<string, any>;
}

async function setupDistributedNodes() {
  // Create multiple system instances with different capabilities
  const nodes = [
    new DistributedSystem({
      nodeInfo: {
        host: 'compute-node-1',
        port: 8081,
        capabilities: {
          maxConcurrentTasks: 4,
          supportedTaskTypes: ['matrix', 'data-processing'],
          resources: { cpu: 4, memory: 8192, gpu: 2 }
        }
      }
    }),
    new DistributedSystem({
      nodeInfo: {
        host: 'compute-node-2',
        port: 8082,
        capabilities: {
          maxConcurrentTasks: 2,
          supportedTaskTypes: ['matrix'],
          resources: { cpu: 2, memory: 4096 }
        }
      }
    }),
    new DistributedSystem({
      nodeInfo: {
        host: 'data-node-1',
        port: 8083,
        capabilities: {
          maxConcurrentTasks: 3,
          supportedTaskTypes: ['data-processing'],
          resources: { cpu: 2, memory: 16384 }
        }
      }
    })
  ];

  // Start all nodes
  await Promise.all(nodes.map(node => node.start()));
  logger.info('All nodes started successfully');

  return nodes;
}

async function matrixMultiplicationExample(mainNode: DistributedSystem) {
  // Create sample matrices
  const matrix1 = Array(100).fill(0).map(() => Array(100).fill(0).map(() => Math.random()));
  const matrix2 = Array(100).fill(0).map(() => Array(100).fill(0).map(() => Math.random()));
  const matrix3 = Array(100).fill(0).map(() => Array(100).fill(0).map(() => Math.random()));

  // Submit matrix multiplication tasks
  const taskIds = await Promise.all([
    mainNode.submitTask(
      'matrix',
      {
        operation: 'multiply',
        matrices: [matrix1, matrix2]
      },
      { supportedTaskTypes: ['matrix'] },
      TaskPriority.HIGH
    ),
    mainNode.submitTask(
      'matrix',
      {
        operation: 'multiply',
        matrices: [matrix2, matrix3]
      },
      { supportedTaskTypes: ['matrix'] },
      TaskPriority.NORMAL
    )
  ]);

  // Monitor task progress
  const results = await Promise.all(
    taskIds.map(async (taskId) => {
      let task;
      do {
        task = mainNode.getTask(taskId);
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (task?.status === 'running' || task?.status === 'pending');

      return task?.result;
    })
  );

  logger.info('Matrix multiplication results:', results);
}

async function dataProcessingExample(mainNode: DistributedSystem) {
  // Generate sample data
  const data = Array(10000).fill(0).map((_, i) => ({
    id: i,
    value: Math.random() * 1000,
    timestamp: Date.now() - Math.random() * 86400000,
    category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)]
  }));

  // Submit data processing tasks
  const filterTaskId = await mainNode.submitTask(
    'data-processing',
    {
      operation: 'filter',
      data,
      parameters: {
        conditions: [
          { field: 'value', operator: '>', value: 500 },
          { field: 'category', operator: '==', value: 'A' }
        ]
      }
    },
    { supportedTaskTypes: ['data-processing'] },
    TaskPriority.HIGH
  );

  const aggregateTaskId = await mainNode.submitTask(
    'data-processing',
    {
      operation: 'aggregate',
      data,
      parameters: {
        groupBy: 'category',
        aggregations: [
          { field: 'value', function: 'avg' },
          { field: 'value', function: 'sum' }
        ]
      }
    },
    { supportedTaskTypes: ['data-processing'] },
    TaskPriority.NORMAL
  );

  // Monitor tasks and handle results
  const [filterResult, aggregateResult] = await Promise.all([
    waitForTask(mainNode, filterTaskId),
    waitForTask(mainNode, aggregateTaskId)
  ]);

  logger.info('Filtered data count:', filterResult?.length);
  logger.info('Aggregation results:', aggregateResult);
}

async function faultToleranceExample(mainNode: DistributedSystem, nodes: DistributedSystem[]) {
  // Submit long-running task
  const taskId = await mainNode.submitTask(
    'matrix',
    {
      operation: 'multiply',
      matrices: [
        Array(200).fill(0).map(() => Array(200).fill(0).map(() => Math.random())),
        Array(200).fill(0).map(() => Array(200).fill(0).map(() => Math.random()))
      ]
    },
    {
      supportedTaskTypes: ['matrix'],
      minNodes: 2,
      maxRetries: 3
    },
    TaskPriority.HIGH
  );

  // Simulate node failure
  setTimeout(() => {
    const nodeToFail = nodes[1];
    logger.warn(`Simulating failure of node ${nodeToFail.getNode(nodeToFail.getActiveNodes()[0].id)?.host}`);
    nodeToFail.stop();
  }, 2000);

  // Monitor task completion despite node failure
  const result = await waitForTask(mainNode, taskId);
  logger.info('Task completed successfully despite node failure:', !!result);
}

async function waitForTask(system: DistributedSystem, taskId: string) {
  let task;
  do {
    task = system.getTask(taskId);
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (task?.status === 'running' || task?.status === 'pending');

  return task?.result;
}

async function main() {
  try {
    // Setup distributed system nodes
    const nodes = await setupDistributedNodes();
    const mainNode = nodes[0];

    // Wait for node discovery
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run examples
    logger.info('Starting matrix multiplication example...');
    await matrixMultiplicationExample(mainNode);

    logger.info('Starting data processing example...');
    await dataProcessingExample(mainNode);

    logger.info('Starting fault tolerance example...');
    await faultToleranceExample(mainNode, nodes);

    // Display final system statistics
    const stats = mainNode.getStatistics();
    logger.info('Final system statistics:', stats);

    // Graceful shutdown
    await Promise.all(nodes.map(node => node.stop()));
    logger.info('All nodes stopped successfully');

  } catch (error) {
    logger.error('Example failed:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
} 