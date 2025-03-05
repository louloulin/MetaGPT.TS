import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { PluginManagerImpl } from '../../src/plugin/manager';
import type { Plugin } from '../../src/plugin/types';

describe('Plugin System', () => {
  let manager: PluginManagerImpl;

  beforeEach(() => {
    manager = new PluginManagerImpl();
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('Plugin Registration', () => {
    test('registers valid plugin', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test Plugin',
        hooks: {},
        init: async () => {},
        cleanup: async () => {},
      };

      await manager.register(plugin);
      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });

    test('rejects duplicate plugin registration', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test Plugin',
        hooks: {},
        init: async () => {},
        cleanup: async () => {},
      };

      await manager.register(plugin);
      await expect(manager.register(plugin)).rejects.toThrow('already registered');
    });

    test('validates plugin metadata', async () => {
      const invalidPlugin = {
        version: '1.0.0',
        hooks: {},
        init: async () => {},
        cleanup: async () => {},
      };

      await expect(manager.register(invalidPlugin as Plugin)).rejects.toThrow('name is required');
    });
  });

  describe('Plugin Dependencies', () => {
    test('handles plugin dependencies', async () => {
      const basePlugin: Plugin = {
        name: 'base-plugin',
        version: '1.0.0',
        hooks: {},
        init: async () => {},
        cleanup: async () => {},
      };

      const dependentPlugin: Plugin = {
        name: 'dependent-plugin',
        version: '1.0.0',
        hooks: {},
        init: async () => {},
        cleanup: async () => {},
      };

      await manager.register(basePlugin);
      await manager.register(dependentPlugin);

      expect(manager.getPlugin('base-plugin')).toBe(basePlugin);
      expect(manager.getPlugin('dependent-plugin')).toBe(dependentPlugin);
    });

    test('rejects missing dependencies', async () => {
      const dependentPlugin: Plugin = {
        name: 'dependent-plugin',
        version: '1.0.0',
        hooks: {},
        init: async () => {
          throw new Error('Missing dependency');
        },
        cleanup: async () => {},
      };

      await manager.register(dependentPlugin);
      await expect(manager.init()).rejects.toThrow('Missing dependency');
    });
  });

  describe('Plugin Lifecycle', () => {
    test('initializes plugins in dependency order', async () => {
      const initOrder: string[] = [];

      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        init: async () => {
          initOrder.push('plugin1');
        },
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        init: async () => {
          initOrder.push('plugin2');
        },
      };

      await manager.register(plugin1);
      await manager.register(plugin2);
      await manager.init();

      expect(initOrder).toEqual(['plugin1', 'plugin2']);
    });

    test('executes lifecycle hooks', async () => {
      const hookOrder: string[] = [];

      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'before-init': async () => {
            hookOrder.push('before-init');
          },
          'init': async () => {
            hookOrder.push('init');
          },
          'after-init': async () => {
            hookOrder.push('after-init');
          },
        },
      };

      await manager.register(plugin);
      await manager.init();
      await manager.executeHook('before-init');
      await manager.executeHook('init');
      await manager.executeHook('after-init');

      expect(hookOrder).toEqual(['before-init', 'init', 'after-init']);
    });
  });

  describe('Plugin Error Handling', () => {
    test('handles hook execution errors', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          'test-hook': async () => {
            throw new Error('Hook error');
          },
        },
      };

      await manager.register(plugin);
      await expect(manager.executeHook('test-hook')).rejects.toThrow('Hook error');
    });

    test('handles plugin initialization errors', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        init: async () => {
          throw new Error('Init error');
        },
      };

      await manager.register(plugin);
      await expect(manager.init()).rejects.toThrow('Init error');
    });
  });
}); 