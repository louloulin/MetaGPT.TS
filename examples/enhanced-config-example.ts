/**
 * Enhanced Configuration System Example
 * 
 * This example demonstrates how to use the new enhanced configuration system
 * with modular configuration sections, plugins, and dynamic configuration loading.
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { EnhancedConfigManager, getEnhancedConfigManager, ConfigSource } from '../src/config/enhanced-config-manager';
import { PluginConfigManager, getPluginConfigManager, PluginBaseConfigSchema } from '../src/config/plugin-config';
import type { PluginBaseConfig } from '../src/config/plugin-config';
import { logger } from '../src/utils/logger';

/**
 * Sample application configuration schemas
 */

// Database configuration schema
const DatabaseConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().positive().default(5432),
  username: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  maxConnections: z.number().int().positive().default(10),
  connectionTimeout: z.number().int().nonnegative().default(30000),
  ssl: z.boolean().default(false),
});

type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

// Custom LLM configuration schema
const CustomLLMConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default('gpt-4'),
  maxTokens: z.number().int().nonnegative().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  baseUrl: z.string().url().optional(),
  organization: z.string().optional(),
  retryCount: z.number().int().nonnegative().default(3),
  timeout: z.number().int().positive().default(60000),
});

type CustomLLMConfig = z.infer<typeof CustomLLMConfigSchema>;

// User preferences schema
const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.string().default('en'),
  fontSize: z.number().positive().default(14),
  autoSave: z.boolean().default(true),
  notificationsEnabled: z.boolean().default(true),
});

type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * Sample plugin configuration
 */

// Custom plugin schema that extends the base plugin schema
const SearchPluginConfigSchema = z.object({
  engine: z.enum(['google', 'bing', 'duckduckgo']).default('google'),
  apiKey: z.string().optional(),
  maxResults: z.number().int().positive().default(10),
  includeImages: z.boolean().default(false),
  safeModeEnabled: z.boolean().default(true),
});

type SearchPluginConfig = z.infer<typeof SearchPluginConfigSchema> & PluginBaseConfig;

// Another plugin schema
const FileSystemPluginConfigSchema = z.object({
  rootDirectory: z.string().default('./workspace'),
  allowedExtensions: z.array(z.string()).default(['.txt', '.md', '.json', '.yaml', '.yml']),
  maxFileSize: z.number().int().positive().default(10 * 1024 * 1024), // 10MB
  createMissingDirectories: z.boolean().default(true),
  backupEnabled: z.boolean().default(false),
  backupDirectory: z.string().default('./backups'),
});

type FileSystemPluginConfig = z.infer<typeof FileSystemPluginConfigSchema> & PluginBaseConfig;

/**
 * Initialize configuration
 */
async function initializeConfig(): Promise<void> {
  // Get configuration managers
  const configManager = getEnhancedConfigManager();
  const pluginManager = getPluginConfigManager();
  
  // Register main configuration schemas
  configManager.registerSection('database', DatabaseConfigSchema, {
    host: 'localhost',
    port: 5432,
    username: 'metagpt',
    password: 'password',
    database: 'metagpt',
    maxConnections: 10,
    connectionTimeout: 30000,
    ssl: false,
  });
  
  configManager.registerSection('llm', CustomLLMConfigSchema, {
    apiKey: process.env.OPENAI_API_KEY || 'default-api-key',
    model: 'gpt-4-turbo',
    maxTokens: 4096,
    temperature: 0.7,
    retryCount: 3,
    timeout: 60000,
  });
  
  configManager.registerSection('user', UserPreferencesSchema, {
    theme: 'system',
    language: 'en',
    fontSize: 14,
    autoSave: true,
    notificationsEnabled: true,
  });
  
  // Register plugins
  pluginManager.registerPlugin({
    metadata: {
      name: 'search',
      version: '1.0.0',
      description: 'Web search plugin for MetaGPT',
      author: 'MetaGPT Team',
    },
    configSchema: SearchPluginConfigSchema,
    defaultConfig: {
      // Base plugin config
      enabled: true,
      priority: 100,
      // Search specific config
      engine: 'google',
      maxResults: 10,
      includeImages: false,
      safeModeEnabled: true,
    } as SearchPluginConfig,
  });
  
  pluginManager.registerPlugin({
    metadata: {
      name: 'filesystem',
      version: '1.0.0',
      description: 'File system operations plugin',
      author: 'MetaGPT Team',
    },
    configSchema: FileSystemPluginConfigSchema,
    defaultConfig: {
      // Base plugin config
      enabled: true,
      priority: 100,
      // Filesystem specific config
      rootDirectory: './workspace',
      allowedExtensions: ['.txt', '.md', '.json', '.yaml', '.yml'],
      maxFileSize: 10 * 1024 * 1024,
      createMissingDirectories: true,
      backupEnabled: false,
      backupDirectory: './backups',
    } as FileSystemPluginConfig,
  });
  
  // Load configuration from example file
  const exampleConfigPath = path.join(__dirname, 'example-config.json');
  
  // Create example config file if it doesn't exist
  if (!existsSync(exampleConfigPath)) {
    await createExampleConfigFile(exampleConfigPath);
  }
  
  // Load from file and environment
  await configManager.load({
    configPath: exampleConfigPath,
    loadEnv: true,
    defaultConfig: {},
    sourcePriority: [
      ConfigSource.CLI,
      ConfigSource.ENV,
      ConfigSource.FILE,
      ConfigSource.DEFAULT,
    ],
  });
  
  logger.info('Configuration initialized successfully');
}

/**
 * Create example configuration file
 */
async function createExampleConfigFile(filePath: string): Promise<void> {
  const exampleConfig = {
    database: {
      host: 'localhost',
      port: 5432,
      username: 'example_user',
      password: 'example_password',
      database: 'example_db',
    },
    llm: {
      model: 'gpt-4-turbo',
      temperature: 0.8,
      baseUrl: 'https://example.com/api',
    },
    user: {
      theme: 'dark',
      language: 'en-US',
    },
    'plugin.search': {
      engine: 'duckduckgo',
      maxResults: 15,
    },
    'plugin.filesystem': {
      backupEnabled: true,
    },
  };
  
  await fs.writeFile(filePath, JSON.stringify(exampleConfig, null, 2), 'utf-8');
  logger.info(`Example configuration file created at ${filePath}`);
}

/**
 * Display configuration
 */
function displayConfiguration(): void {
  const configManager = getEnhancedConfigManager();
  const pluginManager = getPluginConfigManager();
  
  logger.info('=== Application Configuration ===');
  
  // Database config
  const dbConfig = configManager.getSection<DatabaseConfig>('database');
  logger.info('Database Configuration:');
  logger.info(`  Host: ${dbConfig.host}:${dbConfig.port}`);
  logger.info(`  Database: ${dbConfig.database}`);
  logger.info(`  Max Connections: ${dbConfig.maxConnections}`);
  logger.info(`  SSL Enabled: ${dbConfig.ssl}`);
  
  // LLM config
  const llmConfig = configManager.getSection<CustomLLMConfig>('llm');
  logger.info('LLM Configuration:');
  logger.info(`  Model: ${llmConfig.model}`);
  logger.info(`  Temperature: ${llmConfig.temperature}`);
  logger.info(`  Max Tokens: ${llmConfig.maxTokens}`);
  logger.info(`  Retry Count: ${llmConfig.retryCount}`);
  
  // User preferences
  const userConfig = configManager.getSection<UserPreferences>('user');
  logger.info('User Preferences:');
  logger.info(`  Theme: ${userConfig.theme}`);
  logger.info(`  Language: ${userConfig.language}`);
  logger.info(`  Font Size: ${userConfig.fontSize}px`);
  logger.info(`  Auto Save: ${userConfig.autoSave}`);
  
  logger.info('=== Plugin Configuration ===');
  
  // List registered plugins
  const plugins = pluginManager.getAllPlugins();
  logger.info(`Registered Plugins: ${plugins.length}`);
  
  // Search plugin config
  const searchConfig = pluginManager.getPluginConfig<SearchPluginConfig>('search');
  if (searchConfig) {
    logger.info('Search Plugin:');
    logger.info(`  Enabled: ${searchConfig.enabled}`);
    logger.info(`  Priority: ${searchConfig.priority}`);
    logger.info(`  Engine: ${searchConfig.engine}`);
    logger.info(`  Max Results: ${searchConfig.maxResults}`);
    logger.info(`  Safe Mode: ${searchConfig.safeModeEnabled}`);
  }
  
  // File system plugin config
  const fsConfig = pluginManager.getPluginConfig<FileSystemPluginConfig>('filesystem');
  if (fsConfig) {
    logger.info('File System Plugin:');
    logger.info(`  Enabled: ${fsConfig.enabled}`);
    logger.info(`  Priority: ${fsConfig.priority}`);
    logger.info(`  Root Directory: ${fsConfig.rootDirectory}`);
    logger.info(`  Allowed Extensions: ${fsConfig.allowedExtensions.join(', ')}`);
    logger.info(`  Backup Enabled: ${fsConfig.backupEnabled}`);
  }
}

/**
 * Update configuration example
 */
function updateConfiguration(): void {
  const configManager = getEnhancedConfigManager();
  const pluginManager = getPluginConfigManager();
  
  logger.info('=== Updating Configuration ===');
  
  // Update database configuration
  configManager.updateSection('database', {
    maxConnections: 20,
    ssl: true,
  }, ConfigSource.CLI);
  
  // Update LLM configuration
  configManager.updateSection('llm', {
    temperature: 0.5,
    model: 'gpt-4-turbo-preview',
  }, ConfigSource.CLI);
  
  // Disable a plugin
  pluginManager.disablePlugin('search');
  
  // Update filesystem plugin configuration
  pluginManager.updatePluginConfig<FileSystemPluginConfig>('filesystem', {
    maxFileSize: 20 * 1024 * 1024, // 20MB
    backupEnabled: true,
  });
  
  logger.info('Configuration updated successfully');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    // Initialize configuration
    await initializeConfig();
    
    // Display initial configuration
    logger.info('\n=== Initial Configuration ===');
    displayConfiguration();
    
    // Update configuration
    updateConfiguration();
    
    // Display updated configuration
    logger.info('\n=== Updated Configuration ===');
    displayConfiguration();
    
  } catch (error) {
    logger.error('Error in configuration example:', error);
  }
}

// Run the example
main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
}); 