import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ConfigManager } from '../../src/config/config';
import { LLMType } from '../../src/config/llm';
import fs from 'fs/promises';
import path from 'path';

describe('ConfigManager', () => {
  const testConfigPath = path.join(process.cwd(), 'test-config.yaml');
  const testConfig = {
    llm: {
      apiType: LLMType.OPENAI,
      apiKey: 'test-key',
      model: 'gpt-4',
    },
    proxy: 'http://localhost:8080',
    workspace: {
      root: './test-workspace',
      autoClean: true,
    },
  };

  beforeEach(async () => {
    // Create test config file
    await fs.writeFile(testConfigPath, `
llm:
  apiType: openai
  apiKey: test-key
  model: gpt-4
proxy: http://localhost:8080
workspace:
  root: ./test-workspace
  autoClean: true
`, 'utf-8');
  });

  afterEach(async () => {
    // Clean up test config file
    try {
      await fs.unlink(testConfigPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  test('getInstance returns singleton instance', () => {
    const instance1 = ConfigManager.getInstance();
    const instance2 = ConfigManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('fromHome loads config from home directory', async () => {
    const config = await ConfigManager.fromHome('config.yaml');
    expect(config).toBeDefined();
  });

  test('default loads default configuration', async () => {
    const config = await ConfigManager.default();
    expect(config).toBeDefined();
  });

  test('fromLLMConfig creates config with LLM settings', () => {
    const llmConfig = {
      apiType: LLMType.OPENAI,
      apiKey: 'test-key',
      model: 'gpt-4',
    };
    const config = ConfigManager.fromLLMConfig(llmConfig);
    expect(config).toBeDefined();
    expect(config.getOpenAILLM()).toEqual(expect.objectContaining(llmConfig));
  });

  test('updateViaCLI updates CLI parameters', () => {
    const config = ConfigManager.getInstance();
    const cliParams = {
      projectPath: '/test/project',
      projectName: 'test-project',
      inc: true,
      reqaFile: 'test.txt',
      maxAutoSummarizeCode: 100,
    };
    config.updateViaCLI(cliParams);
    expect(config['config']).toEqual(expect.objectContaining({
      projectPath: '/test/project',
      projectName: 'test-project',
      inc: true,
      reqaFile: 'test.txt',
      maxAutoSummarizeCode: 100,
    }));
  });

  test('extra property getter and setter', () => {
    const config = ConfigManager.getInstance();
    const extraConfig = { customSetting: 'value' };
    config.extra = extraConfig;
    expect(config.extra).toEqual(extraConfig);
  });

  test('getOpenAILLM returns null for non-OpenAI config', () => {
    const config = ConfigManager.fromLLMConfig({
      apiType: LLMType.AZURE,
      apiKey: 'test-key',
      model: 'gpt-4',
    });
    expect(config.getOpenAILLM()).toBeNull();
  });

  test('getAzureLLM returns null for non-Azure config', () => {
    const config = ConfigManager.fromLLMConfig({
      apiType: LLMType.OPENAI,
      apiKey: 'test-key',
      model: 'gpt-4',
    });
    expect(config.getAzureLLM()).toBeNull();
  });
}); 