import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { YamlModel } from '../../src/utils/yaml';
import fs from 'fs/promises';
import path from 'path';

describe('YamlModel', () => {
  const testFilePath = path.join(process.cwd(), 'test.yaml');
  const testData = {
    name: 'test',
    settings: {
      enabled: true,
      count: 42,
      items: ['a', 'b', 'c'],
    },
  };

  beforeEach(async () => {
    // Create test YAML file
    await fs.writeFile(testFilePath, `
name: test
settings:
  enabled: true
  count: 42
  items:
    - a
    - b
    - c
`, 'utf-8');
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  test('parse converts YAML string to object', () => {
    const yamlStr = `
name: test
value: 123
`;
    const result = YamlModel.parse(yamlStr);
    expect(result).toEqual({
      name: 'test',
      value: 123,
    });
  });

  test('parse throws error for invalid YAML', () => {
    const invalidYaml = `
name: test
  invalid:
- broken
  yaml
`;
    expect(() => YamlModel.parse(invalidYaml)).toThrow();
  });

  test('stringify converts object to YAML string', () => {
    const obj = {
      name: 'test',
      value: 123,
    };
    const result = YamlModel.stringify(obj);
    expect(result).toContain('name: test');
    expect(result).toContain('value: 123');
  });

  test('stringify throws error for circular references', () => {
    const obj: any = { name: 'test' };
    obj.self = obj;
    expect(() => YamlModel.stringify(obj)).toThrow();
  });

  test('fromFile loads and parses YAML file', async () => {
    const result = await YamlModel.fromFile(testFilePath);
    expect(result).toEqual(testData);
  });

  test('fromFile throws error for non-existent file', async () => {
    await expect(YamlModel.fromFile('nonexistent.yaml')).rejects.toThrow();
  });

  test('toFile saves object as YAML file', async () => {
    const newFilePath = path.join(process.cwd(), 'new.yaml');
    try {
      await YamlModel.toFile(testData, newFilePath);
      const content = await fs.readFile(newFilePath, 'utf-8');
      expect(content).toContain('name: test');
      expect(content).toContain('enabled: true');
      expect(content).toContain('count: 42');
      expect(content).toContain('- a');
      expect(content).toContain('- b');
      expect(content).toContain('- c');
    } finally {
      try {
        await fs.unlink(newFilePath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  });

  test('toFile throws error for invalid path', async () => {
    await expect(YamlModel.toFile(testData, '/invalid/path/file.yaml')).rejects.toThrow();
  });
}); 