/**
 * Tests for Plugin Configuration System
 * 
 * This file contains tests for the plugin configuration system including
 * the PluginConfigManager and its integration with EnhancedConfigManager.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { EnhancedConfigManager, getEnhancedConfigManager, ConfigSource } from '../../src/config/enhanced-config-manager';
import { PluginConfigManager, getPluginConfigManager } from '../../src/config/plugin-config';
import type { PluginBaseConfig } from '../../src/config/plugin-config';
import { logger } from '../../src/utils/logger';

// Prevent actual logging during tests
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('PluginConfigManager', () => {
  // Test file paths
  const testConfigPath = path.join(process.cwd(), 'test-plugin-config.json');
  
  // Original environment variables
  const originalEnv = { ...process.env };
  
  // Test schema
  const TestSearchPluginSchema = z.object({
    engine: z.enum(['google', 'bing', 'duckduckgo']).default('google'),
    maxResults: z.number().int().positive().default(10),
    safeSearch: z.boolean().default(true),
  });
  
  type TestSearchPluginConfig = z.infer<typeof TestSearchPluginSchema> & PluginBaseConfig;
  
  const TestAnalyticsPluginSchema = z.object({
    trackEvents: z.boolean().default(true),
    anonymizeIp: z.boolean().default(true),
    retention: z.number().int().positive().default(90),
  });
  
  type TestAnalyticsPluginConfig = z.infer<typeof TestAnalyticsPluginSchema> & PluginBaseConfig;
  
  // Setup before each test
  beforeEach(async () => {
    // Reset managers
    getEnhancedConfigManager().reset();
    getPluginConfigManager().reset();
    
    // Create test config file
    await fs.writeFile(testConfigPath, JSON.stringify({
      'plugin.search': {
        enabled: true,
        priority: 100,
        engine: 'bing',
        maxResults: 20,
      },
      'plugin.analytics': {
        enabled: false,
        trackEvents: false,
      },
    }), 'utf-8');
    
    // Set test environment variables
    process.env.METAGPT_PLUGIN_SEARCH_ENGINE = 'duckduckgo';
    process.env.METAGPT_PLUGIN_ANALYTICS_ENABLED = 'true';
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
    const instance1 = PluginConfigManager.getInstance();
    const instance2 = PluginConfigManager.getInstance();
    expect(instance1).toBe(instance2);
  });
  
  test('getPluginConfigManager returns singleton instance', () => {
    const instance1 = getPluginConfigManager();
    const instance2 = getPluginConfigManager();
    expect(instance1).toBe(instance2);
  });
  
  test('registerPlugin registers plugin with metadata and schema', () => {
    const pluginManager = getPluginConfigManager();
    
    const result = pluginManager.registerPlugin({
      metadata: {
        name: 'search',
        version: '1.0.0',
        description: 'Search plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestSearchPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 100,
        engine: 'google',
        maxResults: 10,
        safeSearch: true,
      } as TestSearchPluginConfig,
    });
    
    expect(result).toBe(true);
    expect(pluginManager.hasPlugin('search')).toBe(true);
    
    const metadata = pluginManager.getPluginMetadata('search');
    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('search');
    expect(metadata?.version).toBe('1.0.0');
    
    const config = pluginManager.getPluginConfig<TestSearchPluginConfig>('search');
    expect(config).toBeDefined();
    expect(config?.enabled).toBe(true);
    expect(config?.engine).toBe('google');
    expect(config?.maxResults).toBe(10);
  });
  
  test('registerPlugin with custom section name', () => {
    const pluginManager = getPluginConfigManager();
    
    const result = pluginManager.registerPlugin({
      metadata: {
        name: 'search',
        version: '1.0.0',
        description: 'Search plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestSearchPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 100,
        engine: 'google',
        maxResults: 10,
        safeSearch: true,
      } as TestSearchPluginConfig,
      configSection: 'custom.search',
    });
    
    expect(result).toBe(true);
    
    const config = pluginManager.getPluginConfig<TestSearchPluginConfig>('search', 'custom.search');
    expect(config).toBeDefined();
    expect(config?.engine).toBe('google');
  });
  
  test('load configuration from file', async () => {
    const pluginManager = getPluginConfigManager();
    const configManager = getEnhancedConfigManager();
    
    // Register plugins
    pluginManager.registerPlugin({
      metadata: {
        name: 'search',
        version: '1.0.0',
        description: 'Search plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestSearchPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 100,
        engine: 'google',
        maxResults: 10,
        safeSearch: true,
      } as TestSearchPluginConfig,
    });
    
    pluginManager.registerPlugin({
      metadata: {
        name: 'analytics',
        version: '1.0.0',
        description: 'Analytics plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestAnalyticsPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 200,
        trackEvents: true,
        anonymizeIp: true,
        retention: 90,
      } as TestAnalyticsPluginConfig,
    });
    
    // Load from file
    await configManager.load({
      configPath: testConfigPath,
      loadEnv: false,
    });
    
    // Check search plugin config from file
    const searchConfig = pluginManager.getPluginConfig<TestSearchPluginConfig>('search');
    expect(searchConfig).toBeDefined();
    expect(searchConfig?.enabled).toBe(true);
    expect(searchConfig?.engine).toBe('bing');
    expect(searchConfig?.maxResults).toBe(20);
    expect(searchConfig?.safeSearch).toBe(true); // Default value
    
    // Check analytics plugin config from file
    const analyticsConfig = pluginManager.getPluginConfig<TestAnalyticsPluginConfig>('analytics');
    expect(analyticsConfig).toBeDefined();
    expect(analyticsConfig?.enabled).toBe(false);
    expect(analyticsConfig?.trackEvents).toBe(false);
    expect(analyticsConfig?.anonymizeIp).toBe(true); // Default value
    expect(analyticsConfig?.retention).toBe(90); // Default value
  });
  
  test('load configuration from environment', async () => {
    const pluginManager = getPluginConfigManager();
    const configManager = getEnhancedConfigManager();
    
    // Register plugins
    pluginManager.registerPlugin({
      metadata: {
        name: 'search',
        version: '1.0.0',
        description: 'Search plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestSearchPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 100,
        engine: 'google',
        maxResults: 10,
        safeSearch: true,
      } as TestSearchPluginConfig,
    });
    
    pluginManager.registerPlugin({
      metadata: {
        name: 'analytics',
        version: '1.0.0',
        description: 'Analytics plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestAnalyticsPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 200,
        trackEvents: true,
        anonymizeIp: true,
        retention: 90,
      } as TestAnalyticsPluginConfig,
    });
    
    // Load from environment
    await configManager.load({
      loadEnv: true,
    });
    
    // Check search plugin config from environment
    const searchConfig = pluginManager.getPluginConfig<TestSearchPluginConfig>('search');
    expect(searchConfig).toBeDefined();
    expect(searchConfig?.engine).toBe('duckduckgo');
    
    // Check analytics plugin config from environment
    const analyticsConfig = pluginManager.getPluginConfig<TestAnalyticsPluginConfig>('analytics');
    expect(analyticsConfig).toBeDefined();
    expect(analyticsConfig?.enabled).toBe(true);
  });
  
  test('update plugin configuration', () => {
    const pluginManager = getPluginConfigManager();
    
    // Register plugin
    pluginManager.registerPlugin({
      metadata: {
        name: 'search',
        version: '1.0.0',
        description: 'Search plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestSearchPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 100,
        engine: 'google',
        maxResults: 10,
        safeSearch: true,
      } as TestSearchPluginConfig,
    });
    
    // Update configuration
    const result = pluginManager.updatePluginConfig<TestSearchPluginConfig>('search', {
      engine: 'bing',
      maxResults: 20,
    });
    
    expect(result).toBe(true);
    
    // Get updated configuration
    const config = pluginManager.getPluginConfig<TestSearchPluginConfig>('search');
    expect(config).toBeDefined();
    expect(config?.engine).toBe('bing');
    expect(config?.maxResults).toBe(20);
    expect(config?.safeSearch).toBe(true); // Unchanged
  });
  
  test('enable and disable plugins', () => {
    const pluginManager = getPluginConfigManager();
    
    // Register plugin
    pluginManager.registerPlugin({
      metadata: {
        name: 'search',
        version: '1.0.0',
        description: 'Search plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestSearchPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 100,
        engine: 'google',
        maxResults: 10,
        safeSearch: true,
      } as TestSearchPluginConfig,
    });
    
    // Initially enabled
    expect(pluginManager.isPluginEnabled('search')).toBe(true);
    
    // Disable plugin
    pluginManager.disablePlugin('search');
    expect(pluginManager.isPluginEnabled('search')).toBe(false);
    
    // Enable plugin
    pluginManager.enablePlugin('search');
    expect(pluginManager.isPluginEnabled('search')).toBe(true);
  });
  
  test('getAllPlugins returns all registered plugins', () => {
    const pluginManager = getPluginConfigManager();
    
    // Register plugins
    pluginManager.registerPlugin({
      metadata: {
        name: 'search',
        version: '1.0.0',
        description: 'Search plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestSearchPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 100,
      } as TestSearchPluginConfig,
    });
    
    pluginManager.registerPlugin({
      metadata: {
        name: 'analytics',
        version: '1.0.0',
        description: 'Analytics plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestAnalyticsPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 200,
      } as TestAnalyticsPluginConfig,
    });
    
    // Get all plugins
    const plugins = pluginManager.getAllPlugins();
    expect(plugins.length).toBe(2);
    expect(plugins.find(p => p.name === 'search')).toBeDefined();
    expect(plugins.find(p => p.name === 'analytics')).toBeDefined();
  });
  
  test('reset clears all plugins', () => {
    const pluginManager = getPluginConfigManager();
    
    // Register plugin
    pluginManager.registerPlugin({
      metadata: {
        name: 'search',
        version: '1.0.0',
        description: 'Search plugin for testing',
        author: 'Test Author',
      },
      configSchema: TestSearchPluginSchema,
      defaultConfig: {
        enabled: true,
        priority: 100,
      } as TestSearchPluginConfig,
    });
    
    // Reset
    pluginManager.reset();
    
    // Should have no plugins
    expect(pluginManager.getAllPlugins().length).toBe(0);
    expect(pluginManager.hasPlugin('search')).toBe(false);
  });
}); 