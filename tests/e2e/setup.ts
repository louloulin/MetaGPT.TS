import { afterAll, beforeAll } from 'bun:test';
import { MonitoringSystemImpl } from '../../src/monitoring/system';
import { WebSocketServerImpl } from '../../src/websocket/server';
import { WebSocketClientImpl } from '../../src/websocket/client';
import { PluginManagerImpl } from '../../src/plugin/manager';

/**
 * Global test environment configuration
 */
export class TestEnvironment {
  public monitoring: MonitoringSystemImpl;
  public wsServer: WebSocketServerImpl;
  public wsClient: WebSocketClientImpl;
  public pluginManager: PluginManagerImpl;
  private static instance: TestEnvironment;

  private constructor() {
    this.monitoring = new MonitoringSystemImpl();
    this.wsServer = new WebSocketServerImpl({
      port: 8080,
      onError: (error) => this.monitoring.logger.error('WebSocket server error', error),
    });
    this.wsClient = new WebSocketClientImpl({
      url: 'ws://localhost:8080',
      onError: (error) => this.monitoring.logger.error('WebSocket client error', error),
    });
    this.pluginManager = new PluginManagerImpl();
  }

  public static getInstance(): TestEnvironment {
    if (!TestEnvironment.instance) {
      TestEnvironment.instance = new TestEnvironment();
    }
    return TestEnvironment.instance;
  }

  public async setup(): Promise<void> {
    // Initialize monitoring
    await this.monitoring.init();

    // Start WebSocket server
    await this.wsServer.start();

    // Connect WebSocket client
    await this.wsClient.connect();

    // Initialize plugin manager
    await this.pluginManager.init();

    this.monitoring.logger.info('Test environment setup complete');
  }

  public async teardown(): Promise<void> {
    // Cleanup in reverse order
    await this.pluginManager.destroy();
    await this.wsClient.disconnect();
    await this.wsServer.stop();
    await this.monitoring.shutdown();

    this.monitoring.logger.info('Test environment teardown complete');
  }
}

// Global test environment instance
export const testEnv = TestEnvironment.getInstance();

// Setup and teardown hooks
beforeAll(async () => {
  await testEnv.setup();
});

afterAll(async () => {
  await testEnv.teardown();
}); 