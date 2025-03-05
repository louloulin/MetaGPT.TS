/**
 * @module Config Registry
 * @category Core
 * 
 * Configuration Registry for managing and extending configuration schemas
 */

import { z } from 'zod';
import { merge } from 'lodash';
import { logger } from '../utils/logger';

/**
 * Configuration Registry Schema Type
 */
export type ConfigRegistrySchema = Record<string, z.ZodType<any>>;

/**
 * Configuration Registry class
 * Provides a central registry for configuration schemas with extension capabilities
 */
export class ConfigRegistry {
  private static instance: ConfigRegistry;
  private schemas: ConfigRegistrySchema = {};
  private configs: Record<string, any> = {};

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance of ConfigRegistry
   */
  public static getInstance(): ConfigRegistry {
    if (!ConfigRegistry.instance) {
      ConfigRegistry.instance = new ConfigRegistry();
    }
    return ConfigRegistry.instance;
  }

  /**
   * Register a new configuration schema
   * @param name The name of the configuration section
   * @param schema The zod schema for validating this configuration section
   * @param defaultValue Optional default value for this configuration section
   */
  public registerSchema<T>(name: string, schema: z.ZodType<T>, defaultValue?: T): void {
    if (this.schemas[name]) {
      logger.warn(`Configuration schema for '${name}' already exists and will be overridden`);
    }
    this.schemas[name] = schema;
    
    if (defaultValue) {
      this.setConfig(name, defaultValue);
    }
  }

  /**
   * Extend an existing configuration schema
   * @param name The name of the configuration section to extend
   * @param extension The zod schema extension to add
   * @returns A boolean indicating whether the extension was successful
   */
  public extendSchema(name: string, extension: z.ZodObject<any>): boolean {
    if (!this.schemas[name]) {
      logger.error(`Cannot extend schema '${name}': schema not found`);
      return false;
    }

    try {
      // Create a new schema that extends the original
      // This requires the base schema to be a ZodObject
      if (this.schemas[name] instanceof z.ZodObject) {
        const baseSchema = this.schemas[name] as z.ZodObject<any>;
        // Use extend method for ZodObject schemas
        this.schemas[name] = baseSchema.extend(extension.shape);
        return true;
      } else {
        logger.error(`Schema '${name}' is not a ZodObject and cannot be extended`);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to extend schema '${name}':`, error);
      return false;
    }
  }

  /**
   * Get a configuration schema by name
   * @param name The name of the configuration section
   */
  public getSchema(name: string): z.ZodType<any> | null {
    return this.schemas[name] || null;
  }

  /**
   * Get all registered schemas
   */
  public getAllSchemas(): ConfigRegistrySchema {
    return { ...this.schemas };
  }

  /**
   * Set configuration values for a specific section
   * @param name The name of the configuration section
   * @param config The configuration values
   * @param validate Whether to validate against the schema (default: true)
   */
  public setConfig<T>(name: string, config: T, validate: boolean = true): void {
    if (validate && this.schemas[name]) {
      try {
        // Validate against schema
        const schema = this.schemas[name] as z.ZodType<T>;
        const validated = schema.parse(config);
        this.configs[name] = validated;
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error(`Invalid configuration for '${name}':`, error.format());
          throw new Error(`Invalid configuration for '${name}': ${error.message}`);
        }
        throw error;
      }
    } else {
      // Store without validation
      this.configs[name] = config;
    }
  }

  /**
   * Get configuration values for a specific section
   * @param name The name of the configuration section
   */
  public getConfig<T>(name: string): T | null {
    return (this.configs[name] as T) || null;
  }

  /**
   * Merge configuration values for a specific section
   * @param name The name of the configuration section
   * @param config The configuration values to merge
   * @param validate Whether to validate against the schema (default: true)
   */
  public mergeConfig<T>(name: string, config: Partial<T>, validate: boolean = true): void {
    const existingConfig = this.getConfig<T>(name) || {};
    const mergedConfig = merge({}, existingConfig, config);
    this.setConfig(name, mergedConfig, validate);
  }

  /**
   * Get all configuration values
   */
  public getAllConfigs(): Record<string, any> {
    return { ...this.configs };
  }

  /**
   * Reset the registry to its initial state
   * Useful for testing
   */
  public reset(): void {
    this.schemas = {};
    this.configs = {};
  }
}

/**
 * Get the configuration registry instance
 */
export function getConfigRegistry(): ConfigRegistry {
  return ConfigRegistry.getInstance();
} 