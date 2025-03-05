import { z } from 'zod';

/**
 * Metric types for different measurements
 */
export enum MetricType {
  /** Counter that only increases */
  COUNTER = 'counter',
  /** Gauge that can increase and decrease */
  GAUGE = 'gauge',
  /** Histogram for distribution of values */
  HISTOGRAM = 'histogram',
  /** Summary of observations */
  SUMMARY = 'summary',
}

/**
 * Metric labels schema
 */
export const MetricLabelsSchema = z.record(z.string());

/**
 * Metric value schema
 */
export const MetricValueSchema = z.object({
  /** Value of the metric */
  value: z.number(),
  /** Timestamp of the measurement */
  timestamp: z.number().default(() => Date.now()),
  /** Labels associated with the measurement */
  labels: MetricLabelsSchema.default({}),
});

/**
 * Metric schema
 */
export const MetricSchema = z.object({
  /** Metric name */
  name: z.string(),
  /** Metric type */
  type: z.nativeEnum(MetricType),
  /** Metric description */
  description: z.string(),
  /** Metric unit */
  unit: z.string().optional(),
  /** Labels that this metric can have */
  labelNames: z.array(z.string()).default([]),
});

/**
 * Trace span schema
 */
export const TraceSpanSchema = z.object({
  /** Span ID */
  id: z.string(),
  /** Parent span ID */
  parentId: z.string().optional(),
  /** Trace ID */
  traceId: z.string(),
  /** Operation name */
  name: z.string(),
  /** Start time */
  startTime: z.number(),
  /** End time */
  endTime: z.number().optional(),
  /** Span kind (client, server, producer, consumer) */
  kind: z.enum(['client', 'server', 'producer', 'consumer']).default('client'),
  /** Span status */
  status: z.enum(['ok', 'error', 'unset']).default('unset'),
  /** Error details if status is error */
  error: z.any().optional(),
  /** Span attributes */
  attributes: z.record(z.any()).default({}),
  /** Events that occurred during the span */
  events: z.array(z.object({
    name: z.string(),
    timestamp: z.number(),
    attributes: z.record(z.any()).default({}),
  })).default([]),
});

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log entry schema
 */
export const LogEntrySchema = z.object({
  /** Log timestamp */
  timestamp: z.number().default(() => Date.now()),
  /** Log level */
  level: z.nativeEnum(LogLevel),
  /** Log message */
  message: z.string(),
  /** Log context */
  context: z.record(z.any()).default({}),
  /** Associated trace ID */
  traceId: z.string().optional(),
  /** Associated span ID */
  spanId: z.string().optional(),
});

/**
 * Metric collector interface
 */
export interface MetricCollector {
  /** Create or get a counter metric */
  counter(options: z.infer<typeof MetricSchema>): Counter;
  /** Create or get a gauge metric */
  gauge(options: z.infer<typeof MetricSchema>): Gauge;
  /** Create or get a histogram metric */
  histogram(options: z.infer<typeof MetricSchema>): Histogram;
  /** Create or get a summary metric */
  summary(options: z.infer<typeof MetricSchema>): Summary;
  /** Export metrics in Prometheus format */
  exportPrometheus(): string;
}

/**
 * Counter metric interface
 */
export interface Counter {
  /** Increment counter by given value */
  inc(value?: number, labels?: Record<string, string>): void;
  /** Get current value */
  getValue(labels?: Record<string, string>): number;
}

/**
 * Gauge metric interface
 */
export interface Gauge {
  /** Set gauge to given value */
  set(value: number, labels?: Record<string, string>): void;
  /** Increment gauge by given value */
  inc(value?: number, labels?: Record<string, string>): void;
  /** Decrement gauge by given value */
  dec(value?: number, labels?: Record<string, string>): void;
  /** Get current value */
  getValue(labels?: Record<string, string>): number;
}

/**
 * Histogram metric interface
 */
export interface Histogram {
  /** Observe a value */
  observe(value: number, labels?: Record<string, string>): void;
  /** Get current buckets */
  getBuckets(labels?: Record<string, string>): Record<number, number>;
}

/**
 * Summary metric interface
 */
export interface Summary {
  /** Observe a value */
  observe(value: number, labels?: Record<string, string>): void;
  /** Get current quantiles */
  getQuantiles(labels?: Record<string, string>): Record<number, number>;
}

/**
 * Tracer interface
 */
export interface Tracer {
  /** Start a new span */
  startSpan(name: string, options?: {
    parent?: z.infer<typeof TraceSpanSchema>;
    kind?: z.infer<typeof TraceSpanSchema>['kind'];
    attributes?: Record<string, any>;
  }): z.infer<typeof TraceSpanSchema>;
  /** End a span */
  endSpan(span: z.infer<typeof TraceSpanSchema>): void;
  /** Add an event to a span */
  addEvent(span: z.infer<typeof TraceSpanSchema>, name: string, attributes?: Record<string, any>): void;
  /** Set span status */
  setStatus(span: z.infer<typeof TraceSpanSchema>, status: z.infer<typeof TraceSpanSchema>['status'], error?: any): void;
  /** Get active span for the current context */
  getActiveSpan(): z.infer<typeof TraceSpanSchema> | undefined;
  /** Set active span for the current context */
  setActiveSpan(span: z.infer<typeof TraceSpanSchema>): void;
  /** Clear active span for the current context */
  clearActiveSpan(span: z.infer<typeof TraceSpanSchema>): void;
}

/**
 * Logger interface
 */
export interface Logger {
  /** Log a debug message */
  debug(message: string, context?: Record<string, any>): void;
  /** Log an info message */
  info(message: string, context?: Record<string, any>): void;
  /** Log a warning message */
  warn(message: string, context?: Record<string, any>): void;
  /** Log an error message */
  error(message: string, error?: Error, context?: Record<string, any>): void;
  /** Get logs with optional filtering */
  getLogs(filter?: {
    level?: LogLevel;
    traceId?: string;
    spanId?: string;
    startTime?: number;
    endTime?: number;
  }): any[];
}

/**
 * Monitoring system interface
 */
export interface MonitoringSystem {
  /** Get metric collector */
  metrics: MetricCollector;
  /** Get tracer */
  tracer: Tracer;
  /** Get logger */
  logger: Logger;
  /** Initialize monitoring system */
  init(): Promise<void>;
  /** Shutdown monitoring system */
  shutdown(): Promise<void>;
} 