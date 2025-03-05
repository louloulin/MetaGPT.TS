/**
 * @module Enhanced Config Manager
 * @category Core
 * 
 * Enhanced Configuration Manager that leverages the ConfigRegistry
 * for more flexible and extensible configuration management
 */

import { z } from 'zod';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { merge, get, set, cloneDeep } from 'lodash';
import YAML from 'yaml';
import { logger } from '../utils/logger';
import { ConfigRegistry, getConfigRegistry } from './config-registry';

/**
 * Supported configuration file formats
 */
export enum ConfigFormat {
  JSON = 'json',
  YAML = 'yaml',
  JS = 'js',
}

/**
 * Configuration source
 */
export enum ConfigSource {
  DEFAULT = 'default',
  FILE = 'file',
  ENV = 'env',
  CLI = 'cli',
}

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  /**
   * Configuration file path
   */
  configPath?: string;
  
  /**
   * Whether to load from environment variables
   */
  loadEnv?: boolean;
  
  /**
   * Default configuration values
   */
  defaultConfig?: Record<string, any>;
  
  /**
   * CLI configuration values (highest priority)
   */
  cliConfig?: Record<string, any>;
  
  /**
   * Source priority order (default: cli > env > file > default)
   */
  sourcePriority?: ConfigSource[];
}

/**
 * Environment variable prefix for configuration
 */
const ENV_PREFIX = 'METAGPT_';

/**
 * Enhanced Configuration Manager class
 */
export class EnhancedConfigManager {
  private static instance: EnhancedConfigManager;
  private registry: ConfigRegistry;
  private loadedSources: Partial<Record<ConfigSource, Record<string, any>>> = {};
  private finalConfig: Record<string, any> = {};
  
  /**
   * Constructor
   */
  private constructor() {
    this.registry = getConfigRegistry();
  }
  
  /**
   * Get singleton instance of EnhancedConfigManager
   */
  public static getInstance(): EnhancedConfigManager {
    if (!EnhancedConfigManager.instance) {
      EnhancedConfigManager.instance = new EnhancedConfigManager();
    }
    return EnhancedConfigManager.instance;
  }
  
  /**
   * Register a configuration section schema
   * @param section Configuration section name
   * @param schema Zod schema for validation
   * @param defaultValues Optional default values
   */
  public registerSection<T>(
    section: string, 
    schema: z.ZodType<T>, 
    defaultValues?: T
  ): void {
    this.registry.registerSchema(section, schema, defaultValues);
    
    // If default values provided, add them to default source
    if (defaultValues) {
      if (!this.loadedSources[ConfigSource.DEFAULT]) {
        this.loadedSources[ConfigSource.DEFAULT] = {};
      }
      this.loadedSources[ConfigSource.DEFAULT][section] = defaultValues;
    }
    
    // Rebuild final config to include new section
    this.rebuildFinalConfig();
  }
  
  /**
   * Load configuration from various sources
   * @param options Configuration loading options
   */
  public async load(options: ConfigLoadOptions = {}): Promise<void> {
    const {
      configPath,
      loadEnv = true,
      defaultConfig = {},
      cliConfig = {},
      sourcePriority = [
        ConfigSource.CLI,
        ConfigSource.ENV,
        ConfigSource.FILE,
        ConfigSource.DEFAULT,
      ]
    } = options;
    
    // Reset loaded sources
    this.loadedSources = {};
    
    // Load default configuration
    if (Object.keys(defaultConfig).length > 0) {
      this.loadedSources[ConfigSource.DEFAULT] = cloneDeep(defaultConfig);
    }
    
    // Load from file if specified
    if (configPath && existsSync(configPath)) {
      try {
        const fileConfig = await this.loadFromFile(configPath);
        this.loadedSources[ConfigSource.FILE] = fileConfig;
      } catch (error) {
        logger.error(`Failed to load configuration from file: ${configPath}`, error);
      }
    } else if (!configPath) {
      // Try to find configuration file automatically
      const foundConfigPath = this.findConfigFile();
      if (foundConfigPath) {
        try {
          const fileConfig = await this.loadFromFile(foundConfigPath);
          this.loadedSources[ConfigSource.FILE] = fileConfig;
        } catch (error) {
          logger.error(`Failed to load configuration from auto-detected file: ${foundConfigPath}`, error);
        }
      }
    }
    
    // Load from environment variables
    if (loadEnv) {
      const envConfig = this.loadFromEnvironment();
      if (Object.keys(envConfig).length > 0) {
        this.loadedSources[ConfigSource.ENV] = envConfig;
      }
    }
    
    // Load from CLI arguments
    if (Object.keys(cliConfig).length > 0) {
      this.loadedSources[ConfigSource.CLI] = cloneDeep(cliConfig);
    }
    
    // Build final configuration based on priority
    this.rebuildFinalConfig(sourcePriority);
  }
  
  /**
   * Get the complete configuration object
   */
  public getConfig(): Record<string, any> {
    return cloneDeep(this.finalConfig);
  }
  
  /**
   * Get configuration for a specific section
   * @param section Configuration section name
   */
  public getSection<T>(section: string): T {
    return cloneDeep(this.finalConfig[section] || {}) as T;
  }
  
  /**
   * Update a specific section of configuration
   * @param section Configuration section name
   * @param config New configuration values
   * @param source Source of the configuration
   * @param validate Whether to validate against schema
   */
  public updateSection<T>(
    section: string, 
    config: T, 
    source: ConfigSource = ConfigSource.CLI,
    validate: boolean = true
  ): void {
    // Ensure source exists
    if (!this.loadedSources[source]) {
      this.loadedSources[source] = {};
    }
    
    // Update source with new config
    this.loadedSources[source][section] = cloneDeep(config);
    
    // Rebuild final config
    this.rebuildFinalConfig();
    
    // Validate if needed
    if (validate) {
      const schema = this.registry.getSchema(section);
      if (schema) {
        try {
          schema.parse(this.finalConfig[section]);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.error(`Invalid configuration for section '${section}':`, error.format());
            throw new Error(`Invalid configuration for section '${section}': ${error.message}`);
          }
          throw error;
        }
      }
    }
  }
  
  /**
   * Load configuration from a file
   * @param filePath Path to configuration file
   */
  private async loadFromFile(filePath: string): Promise<Record<string, any>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const extension = path.extname(filePath).toLowerCase();
      
      switch (extension) {
        case '.json':
          return JSON.parse(content);
        case '.yaml':
        case '.yml':
          return YAML.parse(content) || {};
        case '.js':
          // Dynamic import for JS files
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          return require(path.resolve(filePath));
        default:
          logger.warn(`Unsupported configuration file format: ${extension}`);
          return {};
      }
    } catch (error) {
      logger.error(`Failed to read configuration file: ${filePath}`, error);
      return {};
    }
  }
  
  /**
   * Find configuration file in standard locations
   */
  private findConfigFile(): string | null {
    const searchPaths = [
      // Current directory
      path.join(process.cwd(), '.metagpt.json'),
      path.join(process.cwd(), '.metagpt.yaml'),
      path.join(process.cwd(), '.metagpt.yml'),
      path.join(process.cwd(), '.metagpt.js'),
      
      // Config directory
      path.join(process.cwd(), 'config', 'config.json'),
      path.join(process.cwd(), 'config', 'config.yaml'),
      path.join(process.cwd(), 'config', 'config.yml'),
      path.join(process.cwd(), 'config', 'config.js'),
      
      // Standard locations
      path.join(process.cwd(), 'metagpt.config.json'),
      path.join(process.cwd(), 'metagpt.config.yaml'),
      path.join(process.cwd(), 'metagpt.config.yml'),
      path.join(process.cwd(), 'metagpt.config.js'),
      
      // Home directory
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.metagpt', 'config.json'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.metagpt', 'config.yaml'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.metagpt', 'config.yml'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.metagpt', 'config.js'),
    ];
    
    for (const configPath of searchPaths) {
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    
    return null;
  }
  
  /**
   * Load configuration from environment variables
   * Environment variables are mapped to nested configuration properties.
   * For example: METAGPT_LLM_API_KEY -> { llm: { apiKey: 'value' } }
   */
  private loadFromEnvironment(): Record<string, any> {
    const config: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      // Skip if not prefixed with METAGPT_
      if (!key.startsWith(ENV_PREFIX) || value === undefined) {
        continue;
      }
      
      // Remove prefix and convert to camelCase path
      const configPath = this.envKeyToConfigPath(key.slice(ENV_PREFIX.length));
      
      // Auto-convert value types
      const processedValue = this.processEnvValue(value);
      
      // Set in config object
      set(config, configPath, processedValue);
    }
    
    return config;
  }
  
  /**
   * Convert environment variable key to configuration path
   * Example: LLM_API_KEY -> llm.apiKey
   */
  private envKeyToConfigPath(envKey: string): string {
    // Split by underscore
    const parts = envKey.split('_');
    
    // Convert to camelCase
    const camelCaseParts = parts.map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    });
    
    return camelCaseParts.join('.');
  }
  
  /**
   * Process environment variable value
   * Auto-converts strings to appropriate types
   */
  private processEnvValue(value: string): any {
    // Boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }
    
    // Default to string
    return value;
  }
  
  /**
   * Rebuild final configuration based on source priority
   * @param sourcePriority Priority order for configuration sources
   */
  private rebuildFinalConfig(
    sourcePriority: ConfigSource[] = [
      ConfigSource.CLI,
      ConfigSource.ENV,
      ConfigSource.FILE,
      ConfigSource.DEFAULT,
    ]
  ): void {
    // Start with empty config
    this.finalConfig = {};
    
    // Apply sources in reverse priority order (lowest to highest)
    const reversedPriority = [...sourcePriority].reverse();
    
    for (const source of reversedPriority) {
      if (this.loadedSources[source]) {
        this.finalConfig = merge({}, this.finalConfig, this.loadedSources[source]);
      }
    }
    
    // Validate all sections against their schemas
    for (const [section, schema] of Object.entries(this.registry.getAllSchemas())) {
      if (this.finalConfig[section]) {
        try {
          const validated = schema.parse(this.finalConfig[section]);
          this.finalConfig[section] = validated;
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn(`Invalid configuration for section '${section}':`, error.format());
            // Keep the invalid config, but log the warning
          }
        }
      }
    }
  }
  
  /**
   * Reset the configuration manager
   * Useful for testing
   */
  public reset(): void {
    this.loadedSources = {};
    this.finalConfig = {};
    this.registry.reset();
  }
}

/**
 * Get the enhanced configuration manager instance
 */
export function getEnhancedConfigManager(): EnhancedConfigManager {
  return EnhancedConfigManager.getInstance();
} 