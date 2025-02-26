/**
 * Configuration Loader
 * 
 * This module provides utilities for loading and validating configuration from various sources
 * including environment variables, files, and default values.
 * 
 * @module config/config-loader
 * @category Core
 */

import { z } from 'zod';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { ConfigSchema, type Config } from '../types/config';
import { merge, get, set } from 'lodash';
import YAML from 'yaml';
import { logger } from '../utils/logger';

/**
 * Environment variable naming conventions for configuration
 */
const ENV_PREFIX = 'METAGPT_';
const ENV_SEPARATOR = '_';

/**
 * Configuration loader class that handles loading configuration from various sources
 * and validates it against the defined schema.
 */
export class ConfigLoader {
  /**
   * Load configuration from environment variables
   * 
   * Environment variables are mapped to configuration properties.
   * For example, METAGPT_LLM_API_KEY maps to config.llm.apiKey
   * 
   * @returns Validated configuration object
   */
  static fromEnv(): Config {
    const config: Partial<Config> = {
      llm: {
        apiType: process.env.LLM_API_TYPE || process.env.METAGPT_LLM_API_TYPE || 'openai',
        apiKey: process.env.OPENAI_API_KEY || process.env.METAGPT_LLM_API_KEY || '',
        model: process.env.LLM_MODEL || process.env.METAGPT_LLM_MODEL || 'gpt-4',
        maxTokens: Number(process.env.METAGPT_LLM_MAX_TOKENS || 4096),
        temperature: Number(process.env.METAGPT_LLM_TEMPERATURE || 0.7),
        topP: Number(process.env.METAGPT_LLM_TOP_P || 1),
        n: Number(process.env.METAGPT_LLM_N || 1),
        presencePenalty: Number(process.env.METAGPT_LLM_PRESENCE_PENALTY || 0),
        frequencyPenalty: Number(process.env.METAGPT_LLM_FREQUENCY_PENALTY || 0),
        maxRetries: Number(process.env.METAGPT_LLM_MAX_RETRIES || 3),
        timeout: Number(process.env.METAGPT_LLM_TIMEOUT || 60000),
      },
      embedding: {
        apiType: process.env.EMBEDDING_API_TYPE || process.env.METAGPT_EMBEDDING_API_TYPE || 'openai',
        apiKey: process.env.OPENAI_API_KEY || process.env.METAGPT_EMBEDDING_API_KEY || '',
        model: process.env.EMBEDDING_MODEL || process.env.METAGPT_EMBEDDING_MODEL || 'text-embedding-ada-002',
        batchSize: Number(process.env.METAGPT_EMBEDDING_BATCH_SIZE || 512),
        proxy: process.env.PROXY || process.env.METAGPT_PROXY || '',
      },
      proxy: process.env.PROXY || process.env.METAGPT_PROXY || '',
      workspace: {
        root: process.env.WORKSPACE_ROOT || process.env.METAGPT_WORKSPACE_ROOT || './workspace',
        autoClean: process.env.METAGPT_WORKSPACE_AUTO_CLEAN === 'true',
        storagePath: process.env.METAGPT_WORKSPACE_STORAGE_PATH || './storage',
      },
      enableLongtermMemory: process.env.ENABLE_LONGTERM_MEMORY === 'true' || process.env.METAGPT_ENABLE_LONGTERM_MEMORY === 'true',
      language: process.env.METAGPT_LANGUAGE || 'English',
      extra: {},
    };

    // Process all environment variables with METAGPT_ prefix
    Object.keys(process.env).forEach(key => {
      if (key.startsWith(ENV_PREFIX)) {
        // Skip variables that are already handled specifically above
        const skipKeys = [
          `${ENV_PREFIX}LLM_API_TYPE`,
          `${ENV_PREFIX}LLM_API_KEY`,
          `${ENV_PREFIX}LLM_MODEL`,
          `${ENV_PREFIX}LLM_MAX_TOKENS`,
          `${ENV_PREFIX}LLM_TEMPERATURE`,
          `${ENV_PREFIX}LLM_TOP_P`,
          `${ENV_PREFIX}LLM_N`,
          `${ENV_PREFIX}LLM_PRESENCE_PENALTY`,
          `${ENV_PREFIX}LLM_FREQUENCY_PENALTY`,
          `${ENV_PREFIX}LLM_MAX_RETRIES`,
          `${ENV_PREFIX}LLM_TIMEOUT`,
          `${ENV_PREFIX}EMBEDDING_API_TYPE`,
          `${ENV_PREFIX}EMBEDDING_API_KEY`,
          `${ENV_PREFIX}EMBEDDING_MODEL`,
          `${ENV_PREFIX}EMBEDDING_BATCH_SIZE`,
          `${ENV_PREFIX}PROXY`,
          `${ENV_PREFIX}WORKSPACE_ROOT`,
          `${ENV_PREFIX}WORKSPACE_AUTO_CLEAN`,
          `${ENV_PREFIX}WORKSPACE_STORAGE_PATH`,
          `${ENV_PREFIX}ENABLE_LONGTERM_MEMORY`,
          `${ENV_PREFIX}LANGUAGE`,
        ];
        
        if (!skipKeys.includes(key)) {
          try {
            // Convert key from SCREAMING_SNAKE_CASE to camelCase
            // For example: METAGPT_CUSTOM_SETTING -> customSetting
            const propertyName = key.substring(ENV_PREFIX.length)
              .toLowerCase()
              .split(ENV_SEPARATOR)
              .map((part, index) => 
                index === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
              )
              .join('');
            
            const value = process.env[key]!;
            
            // Try to parse value as number, boolean, or keep as string
            if (value.toLowerCase() === 'true') {
              config.extra![propertyName] = true;
            } else if (value.toLowerCase() === 'false') {
              config.extra![propertyName] = false;
            } else if (!isNaN(Number(value)) && value.trim() !== '') {
              config.extra![propertyName] = Number(value);
            } else {
              config.extra![propertyName] = value;
            }
          } catch (error) {
            logger.warn(`Failed to process environment variable ${key}: ${error}`);
          }
        }
      }
    });

    // Validate configuration against schema
    try {
      return ConfigSchema.parse(config);
    } catch (error) {
      logger.error(`Configuration validation error: ${error}`);
      throw error;
    }
  }

  /**
   * Load configuration from a file
   * 
   * Supports multiple file formats: JSON, YAML, JS/CJS
   * 
   * @param filePath Path to the configuration file
   * @returns Validated configuration object
   */
  static async fromFile(filePath: string): Promise<Config> {
    try {
      // Read and parse file content
      const fullPath = path.resolve(filePath);
      
      if (!existsSync(fullPath)) {
        logger.warn(`Configuration file not found: ${fullPath}`);
        return ConfigSchema.parse({});
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      let fileConfig: Partial<Config>;

      // Parse according to file extension
      if (filePath.endsWith('.json')) {
        fileConfig = JSON.parse(content);
      } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        fileConfig = YAML.parse(content);
      } else if (filePath.endsWith('.js') || filePath.endsWith('.cjs')) {
        fileConfig = require(fullPath);
      } else {
        throw new Error(`Unsupported configuration file format: ${filePath}`);
      }

      // Validate configuration against schema
      try {
        return ConfigSchema.parse(fileConfig);
      } catch (error) {
        logger.error(`Configuration validation error in file ${filePath}: ${error}`);
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to load config from ${filePath}: ${error}`);
    }
  }

  /**
   * Find configuration file in common locations
   * 
   * Searches for config files in the following locations:
   * 1. Current directory (.metagpt.json, .metagpt.yaml, etc.)
   * 2. User home directory
   * 
   * @returns Path to configuration file or null if not found
   */
  static findConfigFile(): string | null {
    const configFileNames = [
      '.metagpt.json',
      '.metagpt.yaml',
      '.metagpt.yml',
      '.metagpt.js',
      '.metagpt.cjs',
      'metagpt.config.json',
      'metagpt.config.yaml',
      'metagpt.config.yml',
      'metagpt.config.js',
      'metagpt.config.cjs',
    ];
    
    // Check current directory
    for (const fileName of configFileNames) {
      const filePath = path.resolve(process.cwd(), fileName);
      if (existsSync(filePath)) {
        return filePath;
      }
    }
    
    // Check home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      for (const fileName of configFileNames) {
        const filePath = path.resolve(homeDir, fileName);
        if (existsSync(filePath)) {
          return filePath;
        }
      }
    }
    
    return null;
  }

  /**
   * Load and merge configuration from multiple sources
   * 
   * Loading priorities (later sources override earlier ones):
   * 1. Default config
   * 2. Config file
   * 3. Environment variables
   * 4. Command line arguments
   * 
   * @param options Configuration loading options
   * @returns Merged and validated configuration
   */
  static async load(options: {
    configPath?: string;
    loadEnv?: boolean;
    defaultConfig?: Partial<Config>;
    cliConfig?: Partial<Config>;
  } = {}): Promise<Config> {
    const configs: Partial<Config>[] = [];
    
    // Load from default configuration if provided
    if (options.defaultConfig) {
      logger.debug('Loading default configuration');
      configs.push(options.defaultConfig);
    }

    // Load from auto-detected configuration file if no path is provided
    if (!options.configPath) {
      const autoConfigPath = this.findConfigFile();
      if (autoConfigPath) {
        logger.info(`Auto-detected configuration file: ${autoConfigPath}`);
        options.configPath = autoConfigPath;
      }
    }

    // Load from configuration file if path is provided
    if (options.configPath) {
      try {
        logger.debug(`Loading configuration from file: ${options.configPath}`);
        const fileConfig = await this.fromFile(options.configPath);
        configs.push(fileConfig);
      } catch (error) {
        logger.warn(`Warning: ${error}`);
      }
    }

    // Load from environment variables if enabled
    if (options.loadEnv !== false) {
      try {
        logger.debug('Loading configuration from environment variables');
        const envConfig = this.fromEnv();
        configs.push(envConfig);
      } catch (error) {
        logger.warn(`Warning: Failed to load config from environment: ${error}`);
      }
    }
    
    // Load from CLI arguments if provided
    if (options.cliConfig) {
      logger.debug('Loading configuration from CLI arguments');
      configs.push(options.cliConfig);
    }

    // Merge configurations in order (later sources override earlier ones)
    const mergedConfig = configs.reduce((result, config) => merge({}, result, config), {});
    
    // Validate final merged configuration
    try {
      logger.debug('Validating merged configuration');
      const validated = ConfigSchema.parse(mergedConfig);
      return validated;
    } catch (error) {
      logger.error(`Configuration validation error: ${error}`);
      throw error;
    }
  }

  /**
   * Validate a configuration object against the schema
   * 
   * @param config Configuration object to validate
   * @returns Validated configuration object
   * @throws {Error} If validation fails
   */
  static validate(config: Partial<Config>): Config {
    try {
      const result = ConfigSchema.safeParse(config);
      if (!result.success) {
        throw new Error(`Configuration validation error: ${result.error}`);
      }
      return result.data;
    } catch (error) {
      logger.error(`Configuration validation error: ${error}`);
      throw error;
    }
  }
} 