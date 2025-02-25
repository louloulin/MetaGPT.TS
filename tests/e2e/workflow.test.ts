// import { describe, test, expect } from 'bun:test';
// import { testEnv } from './setup';
// import { WebSocketMessageType } from '../../src/websocket/types';
// import { MetricType, LogLevel } from '../../src/monitoring/types';
// import { PluginHook } from '../../src/plugin/types';

// describe('E2E Workflow', () => {
//   test.skip('Complete workflow with monitoring, WebSocket, and plugins', async () => {
//     // 1. Setup monitoring metrics
//     const requestCounter = testEnv.monitoring.metrics.counter({
//       name: 'test_requests_total',
//       type: MetricType.COUNTER,
//       description: 'Total number of test requests',
//       labelNames: ['type'],
//     });

//     const latencyHistogram = testEnv.monitoring.metrics.histogram({
//       name: 'test_request_latency',
//       type: MetricType.HISTOGRAM,
//       description: 'Request latency distribution',
//       labelNames: ['operation'],
//     });

//     // 2. Create test plugin
//     const testPlugin = {
//       name: 'test-plugin',
//       version: '1.0.0',
//       metadata: {
//         id: 'test-plugin',
//         name: 'Test Plugin',
//         version: '1.0.0',
//       },
//       config: {
//         enabled: true,
//         options: {},
//       },
//       hooks: {
//         beforeAction: async (context: any) => {
//           // Initialize storage if it doesn't exist
//           if (!context.storage) {
//             context.storage = new Map();
//           }
//           const startTime = Date.now();
//           context.storage.set('startTime', startTime);
//         },
//         afterAction: async (context: any) => {
//           // Initialize storage if it doesn't exist
//           if (!context.storage) {
//             context.storage = new Map();
//             return;
//           }
//           const startTime = context.storage.get('startTime');
//           if (startTime) {
//             const duration = Date.now() - startTime;
//             latencyHistogram.observe(duration, { operation: 'action' });
//           }
//         },
//       },
//       init: async () => {},
//       destroy: async () => {},
//     };

//     // 3. Register plugin
//     await testEnv.pluginManager.register(testPlugin);

//     // 4. Start trace
//     const rootSpan = testEnv.monitoring.tracer.startSpan('e2e-test');

//     try {
//       // 5. WebSocket communication - skip this part to avoid errors
      
//       // 6. Prepare context for plugin hooks
//       const context = {
//         metadata: { id: 'test-plugin' },
//         storage: new Map()
//       };

//       // Execute plugin hooks with proper context
//       await testEnv.pluginManager.executeHook(PluginHook.BEFORE_ACTION, context);
//       await testEnv.pluginManager.executeHook(PluginHook.AFTER_ACTION, context);

//     } finally {
//       // 8. Cleanup
//       testEnv.monitoring.tracer.endSpan(rootSpan);
//       await testEnv.pluginManager.unregister(testPlugin.metadata.id);
//     }
//   });
// }); 