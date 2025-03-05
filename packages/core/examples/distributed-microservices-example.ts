/**
 * Distributed Microservices Example
 * 
 * This example demonstrates a distributed microservices architecture with:
 * 1. Service discovery and registration
 * 2. Load balancing
 * 3. Circuit breaking and fallback
 * 4. Message-based communication
 */

import { DistributedSystem, SystemStatus } from '../src/distributed/distributed-system';
import { MessageBroker, MessageType, MessagePriority } from '../src/distributed/message-broker';
import { TaskPriority } from '../src/distributed/task-distributor';
import type { NodeInfo } from '../src/distributed/node-manager';
import { NodeStatus } from '../src/distributed/node-manager';
import { logger } from '../src/utils/logger';

interface ServiceConfig {
  name: string;
  version: string;
  endpoints: string[];
  healthCheck: string;
  dependencies?: string[];
}

interface ServiceRequest {
  service: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: any;
}

class MicroserviceNode extends DistributedSystem {
  protected serviceConfig: ServiceConfig;
  protected healthStatus: 'UP' | 'DOWN' | 'DEGRADED' = 'DOWN';
  protected circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false
  };
  protected nodeId: string;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(serviceConfig: ServiceConfig) {
    const nodeInfo: Partial<NodeInfo> = {
      host: `${serviceConfig.name}-${Math.random().toString(36).substring(7)}`,
      port: 8080 + Math.floor(Math.random() * 1000),
      capabilities: {
        maxConcurrentTasks: 10,
        supportedTaskTypes: ['service-request', 'service-registration', 'health-check'],
        resources: { cpu: 1, memory: 1024 }
      },
      metadata: {
        service: serviceConfig.name,
        version: serviceConfig.version,
        endpoints: serviceConfig.endpoints
      }
    };

    super({ nodeInfo });
    this.serviceConfig = serviceConfig;
    this.nodeId = `${serviceConfig.name}-${Math.random().toString(36).substring(7)}`;

    // Set up task handlers
    this.on('taskSubmitted', this.handleTask.bind(this));
  }

  private async handleTask(task: any): Promise<void> {
    try {
      switch (task.type) {
        case 'service-registration':
          await this.handleServiceRegistration(task.payload);
          break;
        case 'health-check':
          await this.handleHealthCheck(task.payload);
          break;
        case 'service-request':
          await this.handleServiceRequest(task.payload);
          break;
        default:
          logger.warn(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      logger.error(`Task handling failed for ${task.type}:`, error);
    }
  }

  private async handleServiceRegistration(payload: any): Promise<void> {
    logger.info(`Service registered: ${payload.service} (${payload.version})`);
    this.emit('serviceRegistered', payload);
  }

  private async handleHealthCheck(payload: any): Promise<void> {
    logger.info(`Health check for ${this.serviceConfig.name}: ${payload.status}`);
    this.emit('healthCheckCompleted', payload);
  }

  private async handleServiceRequest(payload: ServiceRequest): Promise<void> {
    try {
      const result = await this.handleRequest(payload);
      this.emit('requestCompleted', { request: payload, result });
    } catch (error) {
      this.emit('requestFailed', { request: payload, error });
    }
  }

  async start(): Promise<void> {
    await super.start();
    await this.registerService();
    this.startHealthCheck();
    logger.info(`Service ${this.serviceConfig.name} started successfully`);
  }

  async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.info(`Service ${this.serviceConfig.name} stopping...`);
    await super.stop();
    logger.info(`Service ${this.serviceConfig.name} stopped successfully`);
  }

  protected async registerService(): Promise<void> {
    const nodeInfo = {
      id: this.nodeId,
      host: `${this.serviceConfig.name}-${Math.random().toString(36).substring(7)}`,
      port: 8080 + Math.floor(Math.random() * 1000),
      status: NodeStatus.ACTIVE,
      capabilities: {
        maxConcurrentTasks: 10,
        supportedTaskTypes: ['service-request', 'service-registration', 'health-check'],
        resources: { cpu: 1, memory: 1024 }
      },
      currentLoad: {
        tasks: 0,
        cpu: 0,
        memory: 0
      },
      lastHeartbeat: Date.now(),
      metadata: {
        service: this.serviceConfig.name,
        version: this.serviceConfig.version,
        endpoints: this.serviceConfig.endpoints
      }
    };

    try {
      await this.submitTask('service-registration', {
        service: this.serviceConfig.name,
        version: this.serviceConfig.version,
        endpoints: this.serviceConfig.endpoints,
        nodeId: this.nodeId,
        host: nodeInfo.host,
        port: nodeInfo.port
      });
      logger.info(`Service ${this.serviceConfig.name} registration submitted`);
    } catch (error) {
      logger.error(`Failed to register service ${this.serviceConfig.name}:`, error);
      throw error;
    }
  }

  protected startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = Math.random() > 0.1; // 90% healthy
        this.healthStatus = isHealthy ? 'UP' : 'DEGRADED';

        await this.submitTask('health-check', {
          service: this.serviceConfig.name,
          status: this.healthStatus,
          timestamp: Date.now()
        });
      } catch (error) {
        this.healthStatus = 'DOWN';
        logger.error(`Health check failed for ${this.serviceConfig.name}:`, error);
      }
    }, 5000);
  }

  async handleRequest(request: ServiceRequest): Promise<any> {
    if (this.circuitBreaker.isOpen) {
      if (Date.now() - this.circuitBreaker.lastFailure > 30000) {
        // Reset after 30 seconds
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      // Simulate processing
      if (Math.random() > 0.9) { // 10% chance of failure
        throw new Error('Service processing failed');
      }

      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      const result = {
        success: true,
        data: `Processed ${request.method} ${request.endpoint}`,
        timestamp: Date.now()
      };

      // Reset circuit breaker on success
      this.circuitBreaker.failures = 0;
      return result;

    } catch (error) {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();

      if (this.circuitBreaker.failures >= 5) {
        this.circuitBreaker.isOpen = true;
      }

      throw error;
    }
  }

  getServiceConfig(): ServiceConfig {
    return this.serviceConfig;
  }
}

async function setupMicroservices() {
  // Create service instances
  const services = [
    new MicroserviceNode({
      name: 'user-service',
      version: '1.0.0',
      endpoints: ['/users', '/users/:id', '/users/:id/profile'],
      healthCheck: '/health'
    }),
    new MicroserviceNode({
      name: 'auth-service',
      version: '1.0.0',
      endpoints: ['/auth/login', '/auth/logout', '/auth/verify'],
      healthCheck: '/health'
    }),
    new MicroserviceNode({
      name: 'product-service',
      version: '1.0.0',
      endpoints: ['/products', '/products/:id', '/products/search'],
      healthCheck: '/health',
      dependencies: ['user-service']
    })
  ];

  // Start all services
  await Promise.all(services.map(service => service.start()));
  logger.info('All microservices started successfully');

  return services;
}

async function simulateRequests(services: MicroserviceNode[]) {
  const requests: ServiceRequest[] = [
    {
      service: 'user-service',
      endpoint: '/users',
      method: 'GET'
    },
    {
      service: 'auth-service',
      endpoint: '/auth/login',
      method: 'POST',
      payload: { username: 'testuser', password: 'password' }
    },
    {
      service: 'product-service',
      endpoint: '/products/search',
      method: 'GET',
      payload: { query: 'electronics' }
    }
  ];

  // Process requests with retries and circuit breaking
  for (const request of requests) {
    const service = services.find(s => s.getServiceConfig().name === request.service);
    if (!service) {
      logger.error(`Service ${request.service} not found`);
      continue;
    }

    try {
      const result = await service.handleRequest(request);
      logger.info(`Request to ${request.service} succeeded:`, result);
    } catch (error) {
      logger.error(`Request to ${request.service} failed:`, error);
      
      // Retry with fallback service if available
      const fallbackService = services.find(
        s => s.getServiceConfig().name === request.service && s !== service
      );
      
      if (fallbackService) {
        try {
          const fallbackResult = await fallbackService.handleRequest(request);
          logger.info(`Fallback request to ${request.service} succeeded:`, fallbackResult);
        } catch (fallbackError) {
          logger.error(`Fallback request to ${request.service} also failed:`, fallbackError);
        }
      }
    }
  }
}

async function main() {
  try {
    // Setup microservices
    const services = await setupMicroservices();

    // Wait for service discovery and initialization
    logger.info('Waiting for service discovery...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Simulate service requests
    logger.info('Starting service requests simulation...');
    await simulateRequests(services);

    // Wait for requests to complete
    logger.info('Waiting for requests to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Display service statistics
    for (const service of services) {
      const stats = service.getStatistics();
      logger.info(`${service.getServiceConfig().name} statistics:`, stats);
    }

    // Wait before shutdown
    logger.info('Preparing for shutdown...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Graceful shutdown
    await Promise.all(services.map(service => service.stop()));
    logger.info('All microservices stopped successfully');

  } catch (error) {
    logger.error('Microservices example failed:', error);
  }
}

main(); 