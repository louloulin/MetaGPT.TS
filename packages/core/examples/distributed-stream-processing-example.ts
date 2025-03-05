/**
 * Distributed Stream Processing Example
 * 
 * This example demonstrates a distributed stream processing system with:
 * 1. Real-time data ingestion
 * 2. Stream processing and analytics
 * 3. Windowed operations
 * 4. Fault-tolerant processing
 */

import { DistributedSystem, SystemStatus } from '../src/distributed/distributed-system';
import { MessageBroker, MessageType, MessagePriority } from '../src/distributed/message-broker';
import { TaskPriority } from '../src/distributed/task-distributor';
import { logger } from '../src/utils/logger';

interface StreamEvent {
  id: string;
  timestamp: number;
  type: string;
  data: any;
}

interface WindowConfig {
  type: 'tumbling' | 'sliding' | 'session';
  size: number;  // Window size in milliseconds
  slide?: number; // For sliding windows, how often to slide
  timeout?: number; // For session windows, session timeout
}

class StreamProcessor extends DistributedSystem {
  private windowedData: Map<string, StreamEvent[]> = new Map();
  private windowConfigs: Map<string, WindowConfig> = new Map();
  private processingCallbacks: Map<string, (events: StreamEvent[]) => Promise<any>> = new Map();

  constructor(processorConfig: {
    name: string;
    windows: { [key: string]: WindowConfig };
    processingFns: { [key: string]: (events: StreamEvent[]) => Promise<any> };
  }) {
    super({
      nodeInfo: {
        host: `stream-processor-${processorConfig.name}`,
        port: 8080 + Math.floor(Math.random() * 1000),
        capabilities: {
          maxConcurrentTasks: 5,
          supportedTaskTypes: ['stream-processing'],
          resources: { cpu: 2, memory: 4096 }
        }
      }
    });

    // Initialize windows and callbacks
    Object.entries(processorConfig.windows).forEach(([key, config]) => {
      this.windowConfigs.set(key, config);
      this.windowedData.set(key, []);
    });

    Object.entries(processorConfig.processingFns).forEach(([key, fn]) => {
      this.processingCallbacks.set(key, fn);
    });
  }

  async processEvent(event: StreamEvent): Promise<void> {
    for (const [windowKey, config] of this.windowConfigs.entries()) {
      const windowData = this.windowedData.get(windowKey) || [];
      windowData.push(event);

      // Clean up old events based on window configuration
      const now = Date.now();
      let windowStart: number;

      switch (config.type) {
        case 'tumbling':
          windowStart = now - (now % config.size);
          break;
        case 'sliding':
          windowStart = now - config.size;
          break;
        case 'session':
          windowStart = now - (config.timeout || config.size);
          break;
      }

      // Remove events outside the window
      const validEvents = windowData.filter(e => e.timestamp >= windowStart);
      this.windowedData.set(windowKey, validEvents);

      // Process window if conditions are met
      if (this.shouldProcessWindow(windowKey, config, validEvents)) {
        await this.processWindow(windowKey, validEvents);
      }
    }
  }

  private shouldProcessWindow(windowKey: string, config: WindowConfig, events: StreamEvent[]): boolean {
    if (events.length === 0) return false;

    const now = Date.now();
    const oldestEvent = events[0].timestamp;
    const newestEvent = events[events.length - 1].timestamp;

    switch (config.type) {
      case 'tumbling':
        return newestEvent - oldestEvent >= config.size;
      
      case 'sliding':
        return newestEvent - oldestEvent >= config.slide!;
      
      case 'session':
        return now - newestEvent >= (config.timeout || 0);
      
      default:
        return false;
    }
  }

  private async processWindow(windowKey: string, events: StreamEvent[]): Promise<void> {
    const processingFn = this.processingCallbacks.get(windowKey);
    if (!processingFn) {
      logger.warn(`No processing function found for window ${windowKey}`);
      return;
    }

    try {
      const result = await processingFn(events);
      logger.info(`Processed window ${windowKey}:`, {
        eventsProcessed: events.length,
        windowStart: events[0].timestamp,
        windowEnd: events[events.length - 1].timestamp,
        result
      });
    } catch (error) {
      logger.error(`Error processing window ${windowKey}:`, error);
    }
  }
}

async function setupStreamProcessors() {
  // Create processors for different types of analysis
  const processors = [
    new StreamProcessor({
      name: 'metrics-analyzer',
      windows: {
        'metrics-1min': {
          type: 'tumbling',
          size: 60000 // 1 minute
        },
        'metrics-5min': {
          type: 'sliding',
          size: 300000, // 5 minutes
          slide: 60000  // Slide every 1 minute
        }
      },
      processingFns: {
        'metrics-1min': async (events) => {
          // Calculate basic statistics
          const values = events.map(e => e.data.value);
          return {
            count: values.length,
            average: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
          };
        },
        'metrics-5min': async (events) => {
          // Calculate trending metrics
          const values = events.map(e => e.data.value);
          const sorted = [...values].sort((a, b) => a - b);
          return {
            median: sorted[Math.floor(sorted.length / 2)],
            percentile95: sorted[Math.floor(sorted.length * 0.95)],
            trend: values[values.length - 1] - values[0]
          };
        }
      }
    }),
    new StreamProcessor({
      name: 'anomaly-detector',
      windows: {
        'anomalies': {
          type: 'session',
          size: 300000,  // 5 minutes
          timeout: 30000 // 30 seconds of inactivity starts new session
        }
      },
      processingFns: {
        'anomalies': async (events) => {
          // Detect anomalies using z-score
          const values = events.map(e => e.data.value);
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const stdDev = Math.sqrt(
            values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
          );

          const anomalies = events.filter(e => 
            Math.abs((e.data.value - mean) / stdDev) > 3
          );

          return {
            totalEvents: events.length,
            anomaliesFound: anomalies.length,
            anomalies: anomalies.map(e => ({
              timestamp: e.timestamp,
              value: e.data.value,
              zscore: (e.data.value - mean) / stdDev
            }))
          };
        }
      }
    })
  ];

  // Start all processors
  await Promise.all(processors.map(p => p.start()));
  logger.info('All stream processors started successfully');

  return processors;
}

async function generateStreamData(processors: StreamProcessor[]) {
  const generateEvent = (): StreamEvent => ({
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    type: 'metric',
    data: {
      value: Math.random() * 100 + 
        (Math.random() > 0.95 ? 500 : 0) // Occasionally inject anomalies
    }
  });

  // Generate events every 100ms
  const interval = setInterval(async () => {
    const event = generateEvent();
    
    // Send event to all processors
    await Promise.all(
      processors.map(processor => processor.processEvent(event))
    );
  }, 100);

  // Run for 5 minutes
  await new Promise(resolve => setTimeout(resolve, 300000));
  clearInterval(interval);
}

async function main() {
  try {
    // Setup stream processors
    const processors = await setupStreamProcessors();

    // Wait for processors to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate and process stream data
    await generateStreamData(processors);

    // Display final statistics
    for (const processor of processors) {
      const stats = processor.getStatistics();
      logger.info(`${processor.getNodeInfo().host} statistics:`, stats);
    }

    // Graceful shutdown
    await Promise.all(processors.map(p => p.stop()));
    logger.info('All stream processors stopped successfully');

  } catch (error) {
    logger.error('Stream processing example failed:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
} 