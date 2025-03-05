import { z } from 'zod';
import type {
  Counter,
  Gauge,
  Histogram,
  Summary,
  MetricCollector,
  Tracer,
  Logger,
  MonitoringSystem,
} from './types';
import {
  MetricType,
  MetricSchema,
  TraceSpanSchema,
  LogLevel,
} from './types';

/**
 * In-memory counter metric implementation
 */
class CounterImpl implements Counter {
  private values: Map<string, number> = new Map();

  constructor(private options: z.infer<typeof MetricSchema>) {}

  public inc(value = 1, labels: Record<string, string> = {}): void {
    const key = this.getKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  public getValue(labels: Record<string, string> = {}): number {
    return this.values.get(this.getKey(labels)) || 0;
  }

  private getKey(labels: Record<string, string>): string {
    return JSON.stringify(labels);
  }
}

/**
 * In-memory gauge metric implementation
 */
class GaugeImpl implements Gauge {
  private values: Map<string, number> = new Map();

  constructor(private options: z.infer<typeof MetricSchema>) {}

  public set(value: number, labels: Record<string, string> = {}): void {
    this.values.set(this.getKey(labels), value);
  }

  public inc(value = 1, labels: Record<string, string> = {}): void {
    const key = this.getKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  public dec(value = 1, labels: Record<string, string> = {}): void {
    this.inc(-value, labels);
  }

  public getValue(labels: Record<string, string> = {}): number {
    return this.values.get(this.getKey(labels)) || 0;
  }

  private getKey(labels: Record<string, string>): string {
    return JSON.stringify(labels);
  }
}

/**
 * In-memory histogram metric implementation
 */
class HistogramImpl implements Histogram {
  private buckets: Map<string, Record<number, number>> = new Map();
  private defaultBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  constructor(private options: z.infer<typeof MetricSchema>) {}

  public observe(value: number, labels: Record<string, string> = {}): void {
    const key = this.getKey(labels);
    let bucketValues = this.buckets.get(key);
    if (!bucketValues) {
      bucketValues = this.defaultBuckets.reduce((acc, bound) => {
        acc[bound] = 0;
        return acc;
      }, {} as Record<number, number>);
      this.buckets.set(key, bucketValues);
    }

    for (const bound of this.defaultBuckets) {
      if (value <= bound) {
        bucketValues[bound]++;
      }
    }
  }

  public getBuckets(labels: Record<string, string> = {}): Record<number, number> {
    return this.buckets.get(this.getKey(labels)) || {};
  }

  private getKey(labels: Record<string, string>): string {
    return JSON.stringify(labels);
  }
}

/**
 * In-memory summary metric implementation
 */
class SummaryImpl implements Summary {
  private values: Map<string, number[]> = new Map();
  private defaultQuantiles = [0.5, 0.9, 0.95, 0.99];

  constructor(private options: z.infer<typeof MetricSchema>) {}

  public observe(value: number, labels: Record<string, string> = {}): void {
    const key = this.getKey(labels);
    let values = this.values.get(key);
    if (!values) {
      values = [];
      this.values.set(key, values);
    }
    values.push(value);
  }

  public getQuantiles(labels: Record<string, string> = {}): Record<number, number> {
    const values = this.values.get(this.getKey(labels)) || [];
    if (values.length === 0) return {};

    values.sort((a, b) => a - b);
    return this.defaultQuantiles.reduce((acc, q) => {
      const index = Math.ceil(q * values.length) - 1;
      acc[q] = values[index];
      return acc;
    }, {} as Record<number, number>);
  }

  private getKey(labels: Record<string, string>): string {
    return JSON.stringify(labels);
  }
}

/**
 * In-memory metric collector implementation with Prometheus export support
 */
class MetricCollectorImpl implements MetricCollector {
  private metrics: Map<string, Counter | Gauge | Histogram | Summary> = new Map();

  public counter(options: z.infer<typeof MetricSchema>): Counter {
    const key = this.getKey(options.name, MetricType.COUNTER);
    let metric = this.metrics.get(key) as Counter;
    if (!metric) {
      metric = new CounterImpl(options);
      this.metrics.set(key, metric);
    }
    return metric;
  }

  public gauge(options: z.infer<typeof MetricSchema>): Gauge {
    const key = this.getKey(options.name, MetricType.GAUGE);
    let metric = this.metrics.get(key) as Gauge;
    if (!metric) {
      metric = new GaugeImpl(options);
      this.metrics.set(key, metric);
    }
    return metric;
  }

  public histogram(options: z.infer<typeof MetricSchema>): Histogram {
    const key = this.getKey(options.name, MetricType.HISTOGRAM);
    let metric = this.metrics.get(key) as Histogram;
    if (!metric) {
      metric = new HistogramImpl(options);
      this.metrics.set(key, metric);
    }
    return metric;
  }

  public summary(options: z.infer<typeof MetricSchema>): Summary {
    const key = this.getKey(options.name, MetricType.SUMMARY);
    let metric = this.metrics.get(key) as Summary;
    if (!metric) {
      metric = new SummaryImpl(options);
      this.metrics.set(key, metric);
    }
    return metric;
  }

  private getKey(name: string, type: MetricType): string {
    return `${type}:${name}`;
  }

  /**
   * Export metrics in Prometheus format
   * @returns Prometheus formatted metrics string
   */
  public exportPrometheus(): string {
    const lines: string[] = [];
    
    for (const [key, metric] of this.metrics.entries()) {
      const [type, name] = key.split(':');
      const help = `# HELP ${name} ${(metric as any).options.description}`;
      const typeHelp = `# TYPE ${name} ${type.toLowerCase()}`;
      lines.push(help, typeHelp);

      if (metric instanceof CounterImpl || metric instanceof GaugeImpl) {
        lines.push(`${name} ${metric.getValue()}`);
      } else if (metric instanceof HistogramImpl) {
        const buckets = metric.getBuckets();
        Object.entries(buckets).forEach(([bound, count]) => {
          lines.push(`${name}_bucket{le="${bound}"} ${count}`);
        });
      } else if (metric instanceof SummaryImpl) {
        const quantiles = metric.getQuantiles();
        Object.entries(quantiles).forEach(([q, value]) => {
          lines.push(`${name}{quantile="${q}"} ${value}`);
        });
      }
    }

    return lines.join('\n');
  }
}

/**
 * In-memory tracer implementation with context propagation
 */
class TracerImpl implements Tracer {
  private spans: Map<string, z.infer<typeof TraceSpanSchema>> = new Map();
  private activeSpans: Map<string, z.infer<typeof TraceSpanSchema>> = new Map();

  public startSpan(name: string, options: {
    parent?: z.infer<typeof TraceSpanSchema>;
    kind?: z.infer<typeof TraceSpanSchema>['kind'];
    attributes?: Record<string, any>;
  } = {}): z.infer<typeof TraceSpanSchema> {
    // Use active span as parent if not specified
    const parent = options.parent || this.getActiveSpan();
    const span = TraceSpanSchema.parse({
      id: crypto.randomUUID(),
      traceId: parent?.traceId || crypto.randomUUID(),
      parentId: parent?.id,
      name,
      startTime: Date.now(),
      kind: options.kind,
      attributes: options.attributes,
    });
    this.spans.set(span.id, span);
    this.setActiveSpan(span);
    return span;
  }

  public endSpan(span: z.infer<typeof TraceSpanSchema>): void {
    const storedSpan = this.spans.get(span.id);
    if (storedSpan) {
      storedSpan.endTime = Date.now();
      this.clearActiveSpan(span);
    }
  }

  public addEvent(span: z.infer<typeof TraceSpanSchema>, name: string, attributes: Record<string, any> = {}): void {
    const storedSpan = this.spans.get(span.id);
    if (storedSpan) {
      storedSpan.events.push({
        name,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  public setStatus(span: z.infer<typeof TraceSpanSchema>, status: z.infer<typeof TraceSpanSchema>['status'], error?: any): void {
    const storedSpan = this.spans.get(span.id);
    if (storedSpan) {
      storedSpan.status = status;
      if (error) {
        storedSpan.error = error;
      }
    }
  }

  /**
   * Get active span for the current context
   * @returns Currently active span or undefined
   */
  public getActiveSpan(): z.infer<typeof TraceSpanSchema> | undefined {
    return Array.from(this.activeSpans.values())[0];
  }

  /**
   * Set active span for the current context
   * @param span - Span to set as active
   */
  public setActiveSpan(span: z.infer<typeof TraceSpanSchema>): void {
    this.activeSpans.set(span.id, span);
  }

  /**
   * Clear active span for the current context
   * @param span - Span to clear
   */
  public clearActiveSpan(span: z.infer<typeof TraceSpanSchema>): void {
    this.activeSpans.delete(span.id);
  }
}

/**
 * In-memory logger implementation with trace context correlation
 */
class LoggerImpl implements Logger {
  private logs: any[] = [];
  private tracer?: TracerImpl;

  constructor(tracer?: TracerImpl) {
    this.tracer = tracer;
  }

  public debug(message: string, context: Record<string, any> = {}): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  public info(message: string, context: Record<string, any> = {}): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  public warn(message: string, context: Record<string, any> = {}): void {
    this.log(LogLevel.WARN, message, undefined, context);
  }

  public error(message: string, error?: Error, context: Record<string, any> = {}): void {
    this.log(LogLevel.ERROR, message, error, context);
  }

  private log(level: LogLevel, message: string, error?: Error, context: Record<string, any> = {}): void {
    // Get current trace context
    const activeSpan = this.tracer?.getActiveSpan();
    const entry = {
      timestamp: Date.now(),
      level,
      message,
      context: {
        ...context,
        error: error?.message,
        stack: error?.stack,
        traceId: activeSpan?.traceId,
        spanId: activeSpan?.id,
      },
    };
    this.logs.push(entry);
    console[level](message, entry.context);
  }

  /**
   * Get all logs with optional filtering
   * @param filter - Filter criteria
   * @returns Filtered logs
   */
  public getLogs(filter?: {
    level?: LogLevel;
    traceId?: string;
    spanId?: string;
    startTime?: number;
    endTime?: number;
  }): any[] {
    let filtered = this.logs;
    
    if (filter) {
      filtered = filtered.filter(log => {
        if (filter.level && log.level !== filter.level) return false;
        if (filter.traceId && log.context.traceId !== filter.traceId) return false;
        if (filter.spanId && log.context.spanId !== filter.spanId) return false;
        if (filter.startTime && log.timestamp < filter.startTime) return false;
        if (filter.endTime && log.timestamp > filter.endTime) return false;
        return true;
      });
    }

    return filtered;
  }
}

/**
 * Monitoring system implementation
 * 
 * Features:
 * - Metric collection with support for counters, gauges, histograms, and summaries
 * - Prometheus format metric export
 * - Distributed tracing with context propagation
 * - Structured logging with trace correlation
 * - In-memory storage with filtering capabilities
 */
export class MonitoringSystemImpl implements MonitoringSystem {
  public readonly metrics: MetricCollector;
  public readonly tracer: Tracer;
  public readonly logger: Logger;

  constructor() {
    const tracer = new TracerImpl();
    this.metrics = new MetricCollectorImpl();
    this.tracer = tracer;
    this.logger = new LoggerImpl(tracer);
  }

  public async init(): Promise<void> {
    this.logger.info('Monitoring system initialized');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Monitoring system shutdown');
  }
} 