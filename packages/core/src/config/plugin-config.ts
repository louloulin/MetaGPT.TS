/**
 * @module Plugin Config
 * @category Core
 * 
 * Plugin configuration system that integrates with the enhanced configuration manager
 */

import { z } from 'zod';
import { logger } from '../utils/logger';
import { EnhancedConfigManager, getEnhancedConfigManager, ConfigSource } from './enhanced-config-manager';

/**
 * Plugin metadata schema
 */
export const PluginMetadataSchema = z.object({
  /**
   * Plugin name (must be unique)
   */
  name: z.string(),
  
  /**
   * Plugin version
   */
  version: z.string(),
  
  /**
   * Plugin description
   */
  description: z.string().optional(),
  
  /**
   * Plugin author
   */
  author: z.string().optional(),
  
  /**
   * Plugin homepage
   */
  homepage: z.string().optional(),
  
  /**
   * Plugin dependencies
   */
  dependencies: z.record(z.string()).optional(),
});

export type PluginMetadata = z.infer<typeof PluginMetadataSchema>;

/**
 * Plugin base config schema
 * All plugin configurations will extend this schema
 */
export const PluginBaseConfigSchema = z.object({
  /**
   * Whether the plugin is enabled
   */
  enabled: z.boolean().default(true),
  
  /**
   * Plugin priority (lower numbers run first)
   */
  priority: z.number().int().default(100),
});

export type PluginBaseConfig = z.infer<typeof PluginBaseConfigSchema>;

/**
 * Plugin registration options
 */
export interface PluginRegistrationOptions<T extends PluginBaseConfig> {
  /**
   * Plugin metadata
   */
  metadata: PluginMetadata;
  
  /**
   * Plugin configuration schema that extends the base plugin schema
   */
  configSchema: z.ZodObject<any>;
  
  /**
   * Default configuration values
   */
  defaultConfig?: Partial<T>;
  
  /**
   * Configuration section name (defaults to plugin name)
   */
  configSection?: string;
}

/**
 * Plugin manager that handles plugin registration and configuration
 */
export class PluginConfigManager {
  private static instance: PluginConfigManager;
  private configManager: EnhancedConfigManager;
  private plugins: Map<string, PluginMetadata> = new Map();
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.configManager = getEnhancedConfigManager();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): PluginConfigManager {
    if (!PluginConfigManager.instance) {
      PluginConfigManager.instance = new PluginConfigManager();
    }
    return PluginConfigManager.instance;
  }
  
  /**
   * Register a plugin
   * @param options Plugin registration options
   * @returns True if registration was successful
   */
  public registerPlugin<T extends PluginBaseConfig>(
    options: PluginRegistrationOptions<T>
  ): boolean {
    const { metadata, configSchema, defaultConfig = {}, configSection } = options;
    
    try {
      // Validate plugin metadata
      const validatedMetadata = PluginMetadataSchema.parse(metadata);
      
      // Check if plugin already registered
      if (this.plugins.has(validatedMetadata.name)) {
        logger.warn(`Plugin '${validatedMetadata.name}' is already registered`);
        return false;
      }
      
      // Store plugin metadata
      this.plugins.set(validatedMetadata.name, validatedMetadata);
      
      // Register configuration section
      const sectionName = configSection || `plugin.${validatedMetadata.name}`;
      
      // Ensure config schema extends the base plugin schema
      // We need to create a new schema that combines the base schema with the plugin's schema
      const mergedSchema = z.object({
        ...PluginBaseConfigSchema.shape,
        ...configSchema.shape
      });
      
      // Register with config manager
      this.configManager.registerSection(
        sectionName,
        mergedSchema,
        {
          enabled: true,
          priority: 100,
          ...defaultConfig
        } as T
      );
      
      logger.info(`Plugin '${validatedMetadata.name}' registered successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to register plugin:`, error);
      return false;
    }
  }
  
  /**
   * Check if a plugin is registered
   * @param pluginName Plugin name
   */
  public hasPlugin(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }
  
  /**
   * Get plugin metadata
   * @param pluginName Plugin name
   */
  public getPluginMetadata(pluginName: string): PluginMetadata | null {
    return this.plugins.get(pluginName) || null;
  }
  
  /**
   * Get plugin configuration
   * @param pluginName Plugin name
   * @param configSection Optional custom config section name
   */
  public getPluginConfig<T extends PluginBaseConfig>(
    pluginName: string,
    configSection?: string
  ): T | null {
    const sectionName = configSection || `plugin.${pluginName}`;
    return this.configManager.getSection<T>(sectionName);
  }
  
  /**
   * Update plugin configuration
   * @param pluginName Plugin name
   * @param config Configuration values to update
   * @param configSection Optional custom config section name
   * @param source Configuration source
   */
  public updatePluginConfig<T extends PluginBaseConfig>(
    pluginName: string,
    config: Partial<T>,
    configSection?: string,
    source: ConfigSource = ConfigSource.CLI
  ): boolean {
    const sectionName = configSection || `plugin.${pluginName}`;
    
    try {
      // Get current config
      const currentConfig = this.configManager.getSection<T>(sectionName);
      
      // Merge with new config
      const mergedConfig = {
        ...currentConfig,
        ...config
      } as T;
      
      // Update config
      this.configManager.updateSection(sectionName, mergedConfig, source);
      return true;
    } catch (error) {
      logger.error(`Failed to update plugin configuration for '${pluginName}':`, error);
      return false;
    }
  }
  
  /**
   * Get all registered plugins
   */
  public getAllPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Enable a plugin
   * @param pluginName Plugin name
   */
  public enablePlugin(pluginName: string): boolean {
    return this.updatePluginConfig(pluginName, { enabled: true });
  }
  
  /**
   * Disable a plugin
   * @param pluginName Plugin name
   */
  public disablePlugin(pluginName: string): boolean {
    return this.updatePluginConfig(pluginName, { enabled: false });
  }
  
  /**
   * Check if a plugin is enabled
   * @param pluginName Plugin name
   */
  public isPluginEnabled(pluginName: string): boolean {
    const config = this.getPluginConfig<PluginBaseConfig>(pluginName);
    return config?.enabled ?? false;
  }
  
  /**
   * Reset plugin manager
   * Useful for testing
   */
  public reset(): void {
    this.plugins.clear();
  }
}

/**
 * Get plugin config manager instance
 */
export function getPluginConfigManager(): PluginConfigManager {
  return PluginConfigManager.getInstance();
} 