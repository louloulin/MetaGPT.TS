/**
 * Tests for ConfigLoader
 * 
 * This file contains tests for the configuration loader functionality
 * including loading from environment variables, files, and merging configs.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ConfigLoader } from '../../src/config/config-loader';
import { ConfigSchema } from '../../src/types/config';

describe('ConfigLoader', () => {
  // Test file paths
  const testJsonPath = path.join(process.cwd(), 'test-config.json');
  const testYamlPath = path.join(process.cwd(), 'test-config.yaml');
  const testJsPath = path.join(process.cwd(), 'test-config.js');
  const homeConfigPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.metagpt.json');
  
  // Original environment variables
  const originalEnv = { ...process.env };
  
  // Setup before each test
  beforeEach(async () => {
    // Create test JSON config
    await fs.writeFile(testJsonPath, JSON.stringify({
      llm: {
        apiType: 'openai',
        apiKey: 'json-api-key',
        model: 'gpt-4-turbo',
      },
      proxy: 'http://json-proxy:8080',
      workspace: {
        root: './json-workspace',
      }
    }), 'utf-8');
    
    // Create test YAML config
    await fs.writeFile(testYamlPath, `
llm:
  apiType: openai
  apiKey: yaml-api-key
  model: gpt-4
proxy: http://yaml-proxy:8080
workspace:
  root: ./yaml-workspace
  autoClean: true
`, 'utf-8');
    
    // Create test JS config
    await fs.writeFile(testJsPath, `
module.exports = {
  llm: {
    apiType: 'openai',
    apiKey: 'js-api-key',
    model: 'gpt-3.5-turbo',
  },
  proxy: 'http://js-proxy:8080',
  workspace: {
    root: './js-workspace',
  }
}
`, 'utf-8');
    
    // Set test environment variables
    process.env.METAGPT_LLM_API_KEY = 'env-api-key';
    process.env.METAGPT_LLM_MODEL = 'gpt-4-env';
    process.env.METAGPT_PROXY = 'http://env-proxy:8080';
    process.env.METAGPT_WORKSPACE_ROOT = './env-workspace';
    process.env.METAGPT_WORKSPACE_AUTO_CLEAN = 'true';
    process.env.METAGPT_ENABLE_LONGTERM_MEMORY = 'true';
  });
  
  // Cleanup after each test
  afterEach(async () => {
    // Restore original environment
    process.env = { ...originalEnv };
    
    // Clean up test files
    const files = [testJsonPath, testYamlPath, testJsPath];
    for (const file of files) {
      if (existsSync(file)) {
        await fs.unlink(file);
      }
    }
  });
  
  // Test environment variable loading
  test('fromEnv loads configuration from environment variables', () => {
    const config = ConfigLoader.fromEnv();
    
    expect(config.llm.apiKey).toBe('env-api-key');
    expect(config.llm.model).toBe('gpt-4-env');
    expect(config.proxy).toBe('http://env-proxy:8080');
    expect(config.workspace.root).toBe('./env-workspace');
    expect(config.workspace.autoClean).toBe(true);
    expect(config.enableLongtermMemory).toBe(true);
  });
  
  // Test environment variable mapping with custom variables
  test('fromEnv correctly maps custom METAGPT_ prefixed variables', () => {
    process.env.METAGPT_CUSTOM_SETTING = 'custom-value';
    process.env.METAGPT_NESTED_SETTING_VALUE = '42';
    process.env.METAGPT_BOOLEAN_FLAG = 'true';
    
    const config = ConfigLoader.fromEnv();
    
    expect(config.extra.customSetting).toBe('custom-value');
    expect(config.extra.nestedSettingValue).toBe(42); // Should be converted to number
    expect(config.extra.booleanFlag).toBe(true); // Should be converted to boolean
  });
  
  // Test loading from JSON file
  test('fromFile loads configuration from JSON file', async () => {
    const config = await ConfigLoader.fromFile(testJsonPath);
    
    expect(config.llm.apiKey).toBe('json-api-key');
    expect(config.llm.model).toBe('gpt-4-turbo');
    expect(config.proxy).toBe('http://json-proxy:8080');
    expect(config.workspace.root).toBe('./json-workspace');
  });
  
  // Test loading from YAML file
  test('fromFile loads configuration from YAML file', async () => {
    const config = await ConfigLoader.fromFile(testYamlPath);
    
    expect(config.llm.apiKey).toBe('yaml-api-key');
    expect(config.llm.model).toBe('gpt-4');
    expect(config.proxy).toBe('http://yaml-proxy:8080');
    expect(config.workspace.root).toBe('./yaml-workspace');
    expect(config.workspace.autoClean).toBe(true);
  });
  
  // Test loading from JS file
  test('fromFile loads configuration from JS file', async () => {
    const config = await ConfigLoader.fromFile(testJsPath);
    
    expect(config.llm.apiKey).toBe('js-api-key');
    expect(config.llm.model).toBe('gpt-3.5-turbo');
    expect(config.proxy).toBe('http://js-proxy:8080');
    expect(config.workspace.root).toBe('./js-workspace');
  });
  
  // Test error handling for non-existent file
  test('fromFile handles non-existent file gracefully', async () => {
    const config = await ConfigLoader.fromFile('non-existent-file.json');
    
    // Should return default config
    expect(config).toBeDefined();
    expect(ConfigSchema.safeParse(config).success).toBe(true);
  });
  
  // Test auto-detection of config files
  test('findConfigFile finds configuration file in current directory', async () => {
    // Create config in current directory
    const currentDirConfig = path.join(process.cwd(), '.metagpt.json');
    await fs.writeFile(currentDirConfig, JSON.stringify({
      llm: { apiKey: 'auto-detect-key' }
    }), 'utf-8');
    
    try {
      const foundPath = ConfigLoader.findConfigFile();
      expect(foundPath).toBe(currentDirConfig);
    } finally {
      // Clean up
      if (existsSync(currentDirConfig)) {
        await fs.unlink(currentDirConfig);
      }
    }
  });
  
  // Test configuration merging
  test('load merges configurations from multiple sources', async () => {
    // Create CLI config
    const cliConfig = {
      projectName: 'cli-project',
      llm: {
        maxTokens: 8000,
      }
    };
    
    // Default config
    const defaultConfig = {
      projectName: 'default-project',
      llm: {
        apiKey: 'default-key',
        model: 'gpt-3.5-turbo',
      }
    };
    
    // Load with all sources
    const config = await ConfigLoader.load({
      configPath: testYamlPath,
      loadEnv: true,
      defaultConfig,
      cliConfig,
    });
    
    // CLI should override environment
    expect(config.projectName).toBe('cli-project');
    
    // Environment should override file
    expect(config.llm.apiKey).toBe('env-api-key');
    expect(config.llm.model).toBe('gpt-4-env');
    
    // File should override defaults
    expect(config.workspace.autoClean).toBe(true);
    
    // CLI specific override
    expect(config.llm.maxTokens).toBe(8000);
  });
  
  // Test loading with auto-detected config file
  test('load auto-detects config file when not specified', async () => {
    // Create config in current directory
    const autoConfigPath = path.join(process.cwd(), '.metagpt.json');
    await fs.writeFile(autoConfigPath, JSON.stringify({
      projectName: 'auto-project',
      llm: { 
        apiKey: 'auto-key',
        model: 'auto-model',
      }
    }), 'utf-8');
    
    try {
      // Temporarily disable environment loading
      const config = await ConfigLoader.load({
        loadEnv: false,
      });
      
      expect(config.projectName).toBe('auto-project');
      expect(config.llm.apiKey).toBe('auto-key');
      expect(config.llm.model).toBe('auto-model');
    } finally {
      // Clean up
      if (existsSync(autoConfigPath)) {
        await fs.unlink(autoConfigPath);
      }
    }
  });
  
  // Test validation
  test('validate validates configuration object', () => {
    const validConfig = {
      llm: {
        apiType: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
      }
    };
    
    const validated = ConfigLoader.validate(validConfig);
    expect(validated).toBeDefined();
    expect(validated.llm.apiKey).toBe('test-key');
    
    // Invalid config should throw
    const invalidConfig = {
      llm: {
        apiType: 123, // Should be string
      }
    };
    
    expect(() => ConfigLoader.validate(invalidConfig as any)).toThrow();
  });
}); 