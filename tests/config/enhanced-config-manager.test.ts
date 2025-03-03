/**
 * Tests for Enhanced Configuration System
 * 
 * This file contains tests for the enhanced configuration system including
 * the EnhancedConfigManager and its integration with ConfigRegistry.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { EnhancedConfigManager, getEnhancedConfigManager, ConfigSource } from '../../src/config/enhanced-config-manager';
import { ConfigRegistry, getConfigRegistry } from '../../src/config/config-registry';

describe('EnhancedConfigManager', () => {
  // Test file paths
  const testConfigPath = path.join(process.cwd(), 'test-enhanced-config.json');
  
  // Original environment variables
  const originalEnv = { ...process.env };
  
  // Test schemas
  const TestDatabaseSchema = z.object({
    host: z.string().default('localhost'),
    port: z.number().int().positive().default(5432),
    username: z.string().min(1),
    password: z.string().min(1),
    database: z.string().min(1),
    ssl: z.boolean().default(false),
  });
  
  type TestDatabaseConfig = z.infer<typeof TestDatabaseSchema>;
  
  const TestLLMSchema = z.object({
    apiKey: z.string().min(1),
    model: z.string().default('gpt-4'),
    temperature: z.number().min(0).max(2).default(0.7),
  });
  
  type TestLLMConfig = z.infer<typeof TestLLMSchema>;
  
  const TestUserSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    language: z.string().default('en'),
  });
  
  type TestUserConfig = z.infer<typeof TestUserSchema>;
  
  // Setup before each test
  beforeEach(async () => {
    // Reset config managers
    getEnhancedConfigManager().reset();
    getConfigRegistry().reset();
    
    // Create test config file
    await fs.writeFile(testConfigPath, JSON.stringify({
      database: {
        host: 'test-db-host',
        port: 5433,
        username: 'test-user',
        password: 'test-password',
        database: 'test-db',
      },
      llm: {
        apiKey: 'test-api-key',
        model: 'gpt-4-turbo',
      },
      user: {
        theme: 'dark',
      },
    }), 'utf-8');
    
    // Set test environment variables
    process.env.METAGPT_DATABASE_HOST = 'env-db-host';
    process.env.METAGPT_LLM_API_KEY = 'env-api-key';
    process.env.METAGPT_USER_THEME = 'light';
  });
  
  // Cleanup after each test
  afterEach(async () => {
    // Restore original environment
    process.env = { ...originalEnv };
    
    // Clean up test files
    if (existsSync(testConfigPath)) {
      await fs.unlink(testConfigPath);
    }
  });
  
  test('getInstance returns singleton instance', () => {
    const instance1 = EnhancedConfigManager.getInstance();
    const instance2 = EnhancedConfigManager.getInstance();
    expect(instance1).toBe(instance2);
  });
  
  test('getEnhancedConfigManager returns singleton instance', () => {
    const instance1 = getEnhancedConfigManager();
    const instance2 = getEnhancedConfigManager();
    expect(instance1).toBe(instance2);
  });
  
  test('registerSection registers configuration schema', () => {
    const configManager = getEnhancedConfigManager();
    
    configManager.registerSection('database', TestDatabaseSchema, {
      host: 'localhost',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
    
    const registry = getConfigRegistry();
    const schema = registry.getSchema('database');
    
    expect(schema).toBeDefined();
    
    const config = registry.getConfig('database');
    expect(config).toEqual({
      host: 'localhost',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
  });
  
  test('load loads configuration from file', async () => {
    const configManager = getEnhancedConfigManager();
    
    // Register schemas
    configManager.registerSection('database', TestDatabaseSchema, {
      host: 'localhost',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
    
    configManager.registerSection('llm', TestLLMSchema, {
      apiKey: 'default-api-key',
      model: 'gpt-4',
      temperature: 0.7,
    });
    
    // Load from file
    await configManager.load({
      configPath: testConfigPath,
      loadEnv: false,
    });
    
    // Get configuration
    const dbConfig = configManager.getSection<TestDatabaseConfig>('database');
    expect(dbConfig.host).toBe('test-db-host');
    expect(dbConfig.port).toBe(5433);
    expect(dbConfig.username).toBe('test-user');
    expect(dbConfig.password).toBe('test-password');
    expect(dbConfig.database).toBe('test-db');
    
    const llmConfig = configManager.getSection<TestLLMConfig>('llm');
    expect(llmConfig.apiKey).toBe('test-api-key');
    expect(llmConfig.model).toBe('gpt-4-turbo');
    expect(llmConfig.temperature).toBe(0.7); // Default value
  });
  
  test('load loads configuration from environment', async () => {
    const configManager = getEnhancedConfigManager();
    
    // Register schemas
    configManager.registerSection('database', TestDatabaseSchema, {
      host: 'localhost',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
    
    configManager.registerSection('llm', TestLLMSchema, {
      apiKey: 'default-api-key',
      model: 'gpt-4',
      temperature: 0.7,
    });
    
    configManager.registerSection('user', TestUserSchema);
    
    // Load from environment
    await configManager.load({
      loadEnv: true,
    });
    
    // Get configuration
    const dbConfig = configManager.getSection<TestDatabaseConfig>('database');
    expect(dbConfig.host).toBe('env-db-host');
    
    const llmConfig = configManager.getSection<TestLLMConfig>('llm');
    expect(llmConfig.apiKey).toBe('env-api-key');
    
    const userConfig = configManager.getSection<TestUserConfig>('user');
    expect(userConfig.theme).toBe('light');
  });
  
  test('load respects source priority', async () => {
    const configManager = getEnhancedConfigManager();
    
    // Register schemas
    configManager.registerSection('database', TestDatabaseSchema, {
      host: 'default-host',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
    
    configManager.registerSection('llm', TestLLMSchema, {
      apiKey: 'default-api-key',
      model: 'gpt-4',
      temperature: 0.7,
    });
    
    configManager.registerSection('user', TestUserSchema);
    
    // CLI config
    const cliConfig = {
      database: {
        host: 'cli-host',
      },
      llm: {
        apiKey: 'cli-api-key',
      },
    };
    
    // Load with custom priority (default > env > file > cli)
    await configManager.load({
      configPath: testConfigPath,
      loadEnv: true,
      cliConfig,
      sourcePriority: [
        ConfigSource.DEFAULT,
        ConfigSource.ENV,
        ConfigSource.FILE,
        ConfigSource.CLI,
      ],
    });
    
    // CLI should have highest priority
    const dbConfig = configManager.getSection<TestDatabaseConfig>('database');
    expect(dbConfig.host).toBe('cli-host');
    
    const llmConfig = configManager.getSection<TestLLMConfig>('llm');
    expect(llmConfig.apiKey).toBe('cli-api-key');
    
    // Load with standard priority (cli > env > file > default)
    configManager.reset();
    
    // Re-register schemas
    configManager.registerSection('database', TestDatabaseSchema, {
      host: 'default-host',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
    
    await configManager.load({
      configPath: testConfigPath,
      loadEnv: true,
      cliConfig,
    });
    
    // CLI should have highest priority
    const dbConfig2 = configManager.getSection<TestDatabaseConfig>('database');
    expect(dbConfig2.host).toBe('cli-host');
    
    // Environment should override file
    process.env.METAGPT_DATABASE_USERNAME = 'env-username';
    configManager.reset();
    
    // Re-register schemas
    configManager.registerSection('database', TestDatabaseSchema, {
      host: 'default-host',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
    
    await configManager.load({
      configPath: testConfigPath,
      loadEnv: true,
    });
    
    const dbConfig3 = configManager.getSection<TestDatabaseConfig>('database');
    expect(dbConfig3.username).toBe('env-username');
    expect(dbConfig3.host).toBe('env-db-host');
  });
  
  test('updateSection updates configuration section', () => {
    const configManager = getEnhancedConfigManager();
    
    // Register schemas
    configManager.registerSection('database', TestDatabaseSchema, {
      host: 'localhost',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
    
    // Update section
    configManager.updateSection('database', {
      host: 'updated-host',
      port: 5434,
    });
    
    // Get updated configuration
    const dbConfig = configManager.getSection<TestDatabaseConfig>('database');
    expect(dbConfig.host).toBe('updated-host');
    expect(dbConfig.port).toBe(5434);
    expect(dbConfig.username).toBe('default-user'); // Unchanged
    
    // Update again with different source
    configManager.updateSection('database', {
      username: 'env-user',
    }, ConfigSource.ENV);
    
    // Update again with higher priority source
    configManager.updateSection('database', {
      username: 'cli-user',
    }, ConfigSource.CLI);
    
    // Get configuration - CLI should override ENV
    const dbConfig2 = configManager.getSection<TestDatabaseConfig>('database');
    expect(dbConfig2.username).toBe('cli-user');
  });
  
  test('reset clears all configuration', () => {
    const configManager = getEnhancedConfigManager();
    
    // Register schemas
    configManager.registerSection('database', TestDatabaseSchema, {
      host: 'localhost',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
    
    // Update section
    configManager.updateSection('database', {
      host: 'updated-host',
    });
    
    // Reset configuration
    configManager.reset();
    
    // Registry should be empty
    const registry = getConfigRegistry();
    expect(registry.getAllSchemas()).toEqual({});
    expect(registry.getAllConfigs()).toEqual({});
    
    // Re-register and check default values
    configManager.registerSection('database', TestDatabaseSchema, {
      host: 'localhost',
      port: 5432,
      username: 'default-user',
      password: 'default-password',
      database: 'default-db',
      ssl: false,
    });
    
    const dbConfig = configManager.getSection<TestDatabaseConfig>('database');
    expect(dbConfig.host).toBe('localhost');
  });
}); 