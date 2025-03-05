import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ConfigManager } from '../src/config/config';

// 重命名为 Legacy ConfigManager 以避免与 tests/config/config.test.ts 冲突
describe.skip('Legacy ConfigManager Tests', () => {
  const testConfigPath = join(process.cwd(), '.test.metagpt.json');
  const testConfig = {
    projectPath: '/test/path',
    llm: {
      apiKey: 'test-api-key',
      model: 'gpt-4',
    },
    workspace: {
      root: './test-workspace',
      autoClean: true,
      storagePath: './test-storage',
    },
  };

  beforeEach(() => {
    // 清理单例实例
    (ConfigManager as any).instance = undefined;
    // 写入测试配置文件
    writeFileSync(testConfigPath, JSON.stringify(testConfig));
    // 设置测试环境变量
    process.env.OPENAI_API_KEY = 'env-api-key';
    process.env.WORKSPACE_ROOT = '/env/workspace';
  });

  afterEach(() => {
    // 清理测试文件和环境变量
    try {
      unlinkSync(testConfigPath);
    } catch (e) {
      // 忽略文件不存在错误
    }
    delete process.env.OPENAI_API_KEY;
    delete process.env.WORKSPACE_ROOT;
  });

  test('should load default config when no options provided', () => {
    const manager = ConfigManager.getInstance();
    const config = manager.getConfig();
    expect(config.projectPath).toBe('');
    expect(config.projectName).toBe('');
    expect(config.language).toBe('English');
  });

  test('should load config from file', () => {
    const manager = ConfigManager.getInstance({
      configPath: testConfigPath,
      loadEnv: false,
      useDefaults: false,
    });
    const config = manager.getConfig();
    expect(config.projectPath).toBe('/test/path');
    expect(config.llm.apiKey).toBe('test-api-key');
    expect(config.workspace.root).toBe('./test-workspace');
  });

  test('should load config from environment variables', () => {
    const manager = ConfigManager.getInstance({
      loadEnv: true,
      useDefaults: false,
    });
    const config = manager.getConfig();
    expect(config.llm.apiKey).toBe('env-api-key');
    expect(config.workspace.root).toBe('/env/workspace');
  });

  test('should merge configs according to priority', () => {
    const manager = ConfigManager.getInstance({
      configPath: testConfigPath,
      loadEnv: true,
      useDefaults: true,
      sourcePriority: ['env', 'file', 'default'],
    });
    const config = manager.getConfig();
    // 环境变量优先级高于文件
    expect(config.llm.apiKey).toBe('env-api-key');
    expect(config.workspace.root).toBe('/env/workspace');
    // 文件配置优先级高于默认值
    expect(config.workspace.autoClean).toBe(true);
  });

  test('should update config', () => {
    const manager = ConfigManager.getInstance();
    manager.updateConfig({
      projectPath: '/new/path',
      llm: {
        apiKey: 'new-api-key',
      },
    });
    const config = manager.getConfig();
    expect(config.projectPath).toBe('/new/path');
    expect(config.llm.apiKey).toBe('new-api-key');
  });

  test('should maintain singleton instance', () => {
    const manager1 = ConfigManager.getInstance();
    const manager2 = ConfigManager.getInstance();
    expect(manager1).toBe(manager2);
  });
}); 