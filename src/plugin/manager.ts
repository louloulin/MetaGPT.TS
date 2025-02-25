import type { Plugin } from './types';

/**
 * Plugin manager implementation for loading and managing plugins
 */
export class PluginManagerImpl {
  private plugins: Map<string, Plugin> = new Map();

  /**
   * Register a plugin
   */
  public async register(plugin: Plugin): Promise<void> {
    if (!plugin.name) {
      throw new Error('Plugin name is required');
    }
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Unregister a plugin
   */
  public async unregister(name: string): Promise<void> {
    if (!this.plugins.has(name)) {
      throw new Error(`Plugin ${name} is not registered`);
    }
    this.plugins.delete(name);
  }

  /**
   * Get a plugin by name
   */
  public getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  public getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Initialize all plugins
   */
  public async init(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.init) {
        await plugin.init();
      }
    }
  }

  /**
   * Cleanup all plugins
   */
  public async destroy(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.cleanup) {
        await plugin.cleanup();
      }
    }
    this.plugins.clear();
  }

  /**
   * Execute a hook across all plugins
   */
  public async executeHook(hook: string, ...args: any[]): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.[hook]) {
        await plugin.hooks[hook](...args);
      }
    }
  }
} 