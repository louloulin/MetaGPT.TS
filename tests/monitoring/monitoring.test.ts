import { describe, test, expect, beforeEach } from 'bun:test';
import { MonitoringSystemImpl } from '../../src/monitoring/system';
import { MetricType, LogLevel } from '../../src/monitoring/types';

describe('MonitoringSystem', () => {
  let monitoring: MonitoringSystemImpl;

  beforeEach(() => {
    monitoring = new MonitoringSystemImpl();
  });

  describe('Metrics', () => {
    test('Counter should track increments', () => {
      const counter = monitoring.metrics.counter({
        name: 'test_counter',
        type: MetricType.COUNTER,
        description: 'Test counter',
        labelNames: [],
      });

      counter.inc();
      counter.inc(2);
      expect(counter.getValue()).toBe(3);

      // Test with labels
      counter.inc(1, { label: 'test' });
      expect(counter.getValue({ label: 'test' })).toBe(1);
    });

    test('Gauge should track values', () => {
      const gauge = monitoring.metrics.gauge({
        name: 'test_gauge',
        type: MetricType.GAUGE,
        description: 'Test gauge',
        labelNames: [],
      });

      gauge.set(5);
      expect(gauge.getValue()).toBe(5);

      gauge.inc(2);
      expect(gauge.getValue()).toBe(7);

      gauge.dec(3);
      expect(gauge.getValue()).toBe(4);

      // Test with labels
      gauge.set(10, { label: 'test' });
      expect(gauge.getValue({ label: 'test' })).toBe(10);
    });

    test('Histogram should track distributions', () => {
      const histogram = monitoring.metrics.histogram({
        name: 'test_histogram',
        type: MetricType.HISTOGRAM,
        description: 'Test histogram',
        labelNames: [],
      });

      histogram.observe(0.1);
      histogram.observe(0.2);
      histogram.observe(1.5);

      const buckets = histogram.getBuckets();
      expect(buckets[0.1]).toBeGreaterThan(0);
      expect(buckets[0.25]).toBeGreaterThan(0);
      expect(buckets[2.5]).toBeGreaterThan(0);
    });

    test('Summary should calculate quantiles', () => {
      const summary = monitoring.metrics.summary({
        name: 'test_summary',
        type: MetricType.SUMMARY,
        description: 'Test summary',
        labelNames: [],
      });

      for (let i = 1; i <= 100; i++) {
        summary.observe(i);
      }

      const quantiles = summary.getQuantiles();
      expect(quantiles[0.5]).toBe(50); // median
      expect(quantiles[0.9]).toBe(90); // 90th percentile
      expect(quantiles[0.99]).toBe(99); // 99th percentile
    });
  });

  describe('Tracing', () => {
    test('Should create and manage spans', () => {
      const rootSpan = monitoring.tracer.startSpan('root');
      expect(rootSpan.id).toBeDefined();
      expect(rootSpan.traceId).toBeDefined();
      expect(rootSpan.startTime).toBeDefined();

      const childSpan = monitoring.tracer.startSpan('child', { parent: rootSpan });
      expect(childSpan.parentId).toBe(rootSpan.id);
      expect(childSpan.traceId).toBe(rootSpan.traceId);

      monitoring.tracer.addEvent(childSpan, 'test_event', { key: 'value' });
      monitoring.tracer.endSpan(childSpan);
      expect(childSpan.endTime).toBeDefined();

      monitoring.tracer.setStatus(rootSpan, 'error', new Error('Test error'));
      expect(rootSpan.status).toBe('error');
      expect(rootSpan.error).toBeDefined();
    });
  });

  describe('Logging', () => {
    test('Should log messages with different levels', () => {
      const messages: string[] = [];
      const originalConsole = { ...console };

      // Mock console methods
      Object.keys(LogLevel).forEach((level) => {
        const logLevel = level.toLowerCase() as keyof Console;
        if (typeof console[logLevel] === 'function') {
          (console[logLevel] as any) = (...args: any[]) => {
            messages.push(args[0]);
          };
        }
      });

      monitoring.logger.debug('Debug message', { context: 'test' });
      monitoring.logger.info('Info message', { context: 'test' });
      monitoring.logger.warn('Warning message', { context: 'test' });
      monitoring.logger.error('Error message', new Error('Test error'), { context: 'test' });

      expect(messages).toContain('Debug message');
      expect(messages).toContain('Info message');
      expect(messages).toContain('Warning message');
      expect(messages).toContain('Error message');

      // Restore console methods
      Object.assign(console, originalConsole);
    });
  });

  describe('System Lifecycle', () => {
    test('Should initialize and shutdown properly', async () => {
      const messages: string[] = [];
      const originalConsole = { ...console };

      console.info = (...args: any[]) => {
        messages.push(args[0]);
      };

      await monitoring.init();
      expect(messages).toContain('Monitoring system initialized');

      await monitoring.shutdown();
      expect(messages).toContain('Monitoring system shutdown');

      Object.assign(console, originalConsole);
    });
  });

  describe('Advanced Features', () => {
    test('Should export metrics in Prometheus format', () => {
      const counter = monitoring.metrics.counter({
        name: 'test_counter',
        type: MetricType.COUNTER,
        description: 'Test counter',
        labelNames: [],
      });
      counter.inc(5);

      const collector = monitoring.metrics as any;
      const output = collector.exportPrometheus();
      
      expect(output).toContain('# HELP test_counter Test counter');
      expect(output).toContain('# TYPE test_counter counter');
      expect(output).toContain('test_counter 5');
    });

    test('Should propagate trace context', () => {
      const rootSpan = monitoring.tracer.startSpan('root');
      const tracer = monitoring.tracer as any;
      
      expect(tracer.getActiveSpan()).toBe(rootSpan);

      const childSpan = monitoring.tracer.startSpan('child');
      expect(childSpan.parentId).toBe(rootSpan.id);
      expect(childSpan.traceId).toBe(rootSpan.traceId);
      
      monitoring.tracer.endSpan(childSpan);
      expect(tracer.getActiveSpan()).toBe(rootSpan);

      monitoring.tracer.endSpan(rootSpan);
      expect(tracer.getActiveSpan()).toBeUndefined();
    });

    test('Should correlate logs with trace context', () => {
      const span = monitoring.tracer.startSpan('test');
      monitoring.logger.info('Test message');

      const logger = monitoring.logger as any;
      const logs = logger.getLogs({ traceId: span.traceId });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].context.traceId).toBe(span.traceId);
      expect(logs[0].context.spanId).toBe(span.id);
    });

    test('Should filter logs by criteria', () => {
      const startTime = Date.now();
      monitoring.logger.debug('Debug message');
      monitoring.logger.info('Info message');
      monitoring.logger.warn('Warning message');
      const endTime = Date.now();

      const logger = monitoring.logger as any;
      
      // Filter by level
      const infoLogs = logger.getLogs({ level: LogLevel.INFO });
      expect(infoLogs).toHaveLength(1);
      expect(infoLogs[0].message).toBe('Info message');

      // Filter by time range
      const timeRangeLogs = logger.getLogs({ startTime, endTime });
      expect(timeRangeLogs).toHaveLength(3);
    });
  });
}); 