import { z } from 'zod';

/**
 * Plugin lifecycle hooks
 */
export enum PluginHook {
  BEFORE_INIT = 'beforeInit',
  AFTER_INIT = 'afterInit',
  BEFORE_ACTION = 'beforeAction',
  AFTER_ACTION = 'afterAction',
  BEFORE_MESSAGE = 'beforeMessage',
  AFTER_MESSAGE = 'afterMessage',
  BEFORE_THINK = 'beforeThink',
  AFTER_THINK = 'afterThink',
  ON_ERROR = 'onError',
}

/**
 * Plugin metadata schema
 */
export const PluginMetadataSchema = z.object({
  /** Unique plugin identifier */
  id: z.string(),
  /** Plugin name */
  name: z.string(),
  /** Plugin version */
  version: z.string(),
  /** Plugin description */
  description: z.string().optional(),
  /** Plugin author */
  author: z.string().optional(),
  /** Plugin homepage */
  homepage: z.string().optional(),
  /** Plugin repository */
  repository: z.string().optional(),
  /** Plugin license */
  license: z.string().optional(),
  /** Plugin dependencies */
  dependencies: z.record(z.string()).optional(),
  /** Plugin configuration schema */
  configSchema: z.any().optional(),
});

/**
 * Plugin configuration schema
 */
export const PluginConfigSchema = z.object({
  /** Whether the plugin is enabled */
  enabled: z.boolean().default(true),
  /** Plugin-specific configuration */
  options: z.record(z.any()).default({}),
});

/**
 * Plugin context passed to hooks
 */
export interface PluginContext {
  /** Plugin metadata */
  metadata: z.infer<typeof PluginMetadataSchema>;
  /** Plugin configuration */
  config: z.infer<typeof PluginConfigSchema>;
  /** Plugin storage */
  storage: Map<string, any>;
  /** Plugin logger */
  logger: {
    debug: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
  };
}

/**
 * Plugin hook handler type
 */
export type PluginHookHandler = (...args: any[]) => Promise<void>;

/**
 * Plugin interface for extending functionality
 */
export interface Plugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin hooks */
  hooks?: Record<string, PluginHookHandler>;
  /** Plugin initialization */
  init?(): Promise<void>;
  /** Plugin cleanup */
  cleanup?(): Promise<void>;
}

/**
 * Plugin manager interface
 */
export interface PluginManager {
  /** Register a plugin */
  register(plugin: Plugin): Promise<void>;
  /** Unregister a plugin */
  unregister(pluginId: string): Promise<void>;
  /** Get a plugin by ID */
  getPlugin(pluginId: string): Plugin | undefined;
  /** Get all registered plugins */
  getPlugins(): Plugin[];
  /** Execute a hook */
  executeHook(hook: PluginHook, ...args: any[]): Promise<void>;
  /** Initialize all plugins */
  init(): Promise<void>;
  /** Destroy all plugins */
  destroy(): Promise<void>;
} 