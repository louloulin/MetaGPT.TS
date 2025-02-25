import { describe, test, expect } from 'bun:test';
import { MonitoringSystemImpl } from '../../src/monitoring/system';
import { WebSocketServerImpl } from '../../src/websocket/server';
import { WebSocketClientImpl } from '../../src/websocket/client';
import { WebSocketMessageType } from '../../src/websocket/types';
import { MetricType } from '../../src/monitoring/types';

describe('Performance Benchmarks', () => {
  const monitoring = new MonitoringSystemImpl();
  const histogram = monitoring.metrics.histogram({
    name: 'benchmark_latency',
    type: MetricType.HISTOGRAM,
    description: 'Benchmark latency distribution',
    labelNames: ['operation'],
  });

  /**
   * Run benchmark with timing measurement
   */
  async function runBenchmark(
    name: string,
    iterations: number,
    fn: () => Promise<void>
  ): Promise<{ mean: number; p95: number; p99: number }> {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const duration = performance.now() - start;
      durations.push(duration);
      histogram.observe(duration, { operation: name });
    }

    durations.sort((a, b) => a - b);
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    monitoring.logger.info(`Benchmark: ${name}`, {
      iterations,
      mean,
      p95,
      p99,
    });

    return { mean, p95, p99 };
  }

  test.skip('WebSocket message throughput', async () => {
    const server = new WebSocketServerImpl({ port: 8081 });
    const client = new WebSocketClientImpl({ url: 'ws://localhost:8081' });
    
    await server.start();
    await client.connect();

    try {
      const iterations = 1000;
      const messageSize = 1024; // 1KB
      const payload = 'a'.repeat(messageSize);
      const results = await runBenchmark('websocket_throughput', iterations, async () => {
        await client.send({
          type: WebSocketMessageType.MESSAGE,
          payload: { content: payload },
          timestamp: Date.now(),
          id: crypto.randomUUID(),
        });
      });

      expect(results.mean).toBeLessThan(10); // Mean latency < 10ms
      expect(results.p95).toBeLessThan(20); // 95th percentile < 20ms
      expect(results.p99).toBeLessThan(50); // 99th percentile < 50ms
    } finally {
      await client.disconnect();
      await server.stop();
    }
  });

  test('Metrics collection performance', async () => {
    const counter = monitoring.metrics.counter({
      name: 'benchmark_counter',
      type: MetricType.COUNTER,
      description: 'Benchmark counter',
      labelNames: ['label'],
    });

    const iterations = 10000;
    const results = await runBenchmark('metrics_collection', iterations, async () => {
      counter.inc(1, { label: 'test' });
    });

    expect(results.mean).toBeLessThan(0.1); // Mean latency < 0.1ms
    expect(results.p95).toBeLessThan(0.2); // 95th percentile < 0.2ms
    expect(results.p99).toBeLessThan(0.5); // 99th percentile < 0.5ms
  });

  test('Tracing overhead', async () => {
    const iterations = 1000;
    const results = await runBenchmark('tracing_overhead', iterations, async () => {
      const span = monitoring.tracer.startSpan('benchmark');
      monitoring.tracer.addEvent(span, 'test_event', { key: 'value' });
      monitoring.tracer.endSpan(span);
    });

    expect(results.mean).toBeLessThan(1); // Mean latency < 1ms
    expect(results.p95).toBeLessThan(2); // 95th percentile < 2ms
    expect(results.p99).toBeLessThan(5); // 99th percentile < 5ms
  });

  test('Logging performance', async () => {
    const iterations = 10000;
    const results = await runBenchmark('logging_performance', iterations, async () => {
      monitoring.logger.info('Benchmark log message', {
        iteration: iterations,
        timestamp: Date.now(),
      });
    });

    expect(results.mean).toBeLessThan(2); // Mean latency < 2ms
    expect(results.p95).toBeLessThan(3); // 95th percentile < 3ms
    expect(results.p99).toBeLessThan(5); // 99th percentile < 5ms
  });

  test('Prometheus export performance', async () => {
    // Setup test metrics
    const testMetrics = Array.from({ length: 100 }, (_, i) => {
      const counter = monitoring.metrics.counter({
        name: `benchmark_metric_${i}`,
        type: MetricType.COUNTER,
        description: `Benchmark metric ${i}`,
        labelNames: ['label'],
      });
      counter.inc(i, { label: 'test' });
      return counter;
    });

    const iterations = 100;
    const results = await runBenchmark('prometheus_export', iterations, async () => {
      const collector = monitoring.metrics as any;
      collector.exportPrometheus();
    });

    expect(results.mean).toBeLessThan(10); // Mean latency < 10ms
    expect(results.p95).toBeLessThan(20); // 95th percentile < 20ms
    expect(results.p99).toBeLessThan(50); // 99th percentile < 50ms
  });
}); 