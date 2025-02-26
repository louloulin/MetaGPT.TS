/**
 * Context System Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextImpl, ContextFactory, GlobalContext } from '../../src/context/context';
import type { Context } from '../../src/context/context';

describe('Context Implementation', () => {
  let context: Context;
  
  beforeEach(() => {
    context = new ContextImpl('test-context', { key: 'value' });
  });
  
  it('should get and set values', () => {
    // Test initial value
    expect(context.get('key')).toBe('value');
    
    // Test setting and getting a new value
    context.set('newKey', 'newValue');
    expect(context.get('newKey')).toBe('newValue');
    
    // Test with different types
    context.set('number', 42);
    expect(context.get('number')).toBe(42);
    
    context.set('object', { nested: 'value' });
    expect(context.get('object')).toEqual({ nested: 'value' });
    
    // Test non-existent key
    expect(context.get('nonExistent')).toBeUndefined();
  });
  
  it('should check if keys exist', () => {
    expect(context.has('key')).toBe(true);
    expect(context.has('nonExistent')).toBe(false);
    
    context.set('newKey', 'value');
    expect(context.has('newKey')).toBe(true);
  });
  
  it('should get all keys', () => {
    const keys = context.keys();
    expect(keys).toContain('key');
    expect(keys.length).toBe(1);
    
    context.set('newKey', 'value');
    const updatedKeys = context.keys();
    expect(updatedKeys).toContain('key');
    expect(updatedKeys).toContain('newKey');
    expect(updatedKeys.length).toBe(2);
  });
  
  it('should merge data', () => {
    context.merge({
      mergedKey1: 'value1',
      mergedKey2: 'value2'
    });
    
    expect(context.get('mergedKey1')).toBe('value1');
    expect(context.get('mergedKey2')).toBe('value2');
    expect(context.get('key')).toBe('value'); // Original data still there
  });
  
  it('should serialize and deserialize', () => {
    const serialized = context.serialize();
    expect(typeof serialized).toBe('string');
    
    const deserialized = ContextFactory.deserialize(serialized);
    expect(deserialized.id).toBe(context.id);
    expect(deserialized.get('key')).toBe('value');
  });
});

describe('Hierarchical Context', () => {
  let parent: Context;
  let child: Context;
  
  beforeEach(() => {
    parent = new ContextImpl('parent', { parentKey: 'parentValue', sharedKey: 'parentValue' });
    child = parent.createChild({ childKey: 'childValue', sharedKey: 'childValue' });
  });
  
  it('should create child context', () => {
    expect(child.parent).toBe(parent);
    expect(child.get('childKey')).toBe('childValue');
  });
  
  it('should inherit values from parent', () => {
    // Child can access parent values
    expect(child.get('parentKey')).toBe('parentValue');
    
    // Parent cannot access child values
    expect(parent.get('childKey')).toBeUndefined();
  });
  
  it('should override parent values', () => {
    // Child value overrides parent for the same key
    expect(child.get('sharedKey')).toBe('childValue');
    expect(parent.get('sharedKey')).toBe('parentValue');
  });
  
  it('should check if keys exist in hierarchy', () => {
    expect(child.has('parentKey')).toBe(true);
    expect(child.has('childKey')).toBe(true);
    expect(child.has('nonExistent')).toBe(false);
  });
  
  it('should only return keys from the current context', () => {
    const childKeys = child.keys();
    expect(childKeys).toContain('childKey');
    expect(childKeys).toContain('sharedKey');
    expect(childKeys).not.toContain('parentKey');
    expect(childKeys.length).toBe(2);
  });
});

describe('Context Factory', () => {
  it('should create root context', () => {
    const root = ContextFactory.createRoot({ rootKey: 'rootValue' });
    expect(root.id).toBe('root');
    expect(root.get('rootKey')).toBe('rootValue');
    expect(root.parent).toBeUndefined();
  });
  
  it('should deserialize context', () => {
    const serialized = JSON.stringify({
      id: 'test-id',
      data: { key: 'value' },
      parentId: 'parent-id'
    });
    
    const context = ContextFactory.deserialize(serialized);
    expect(context.id).toBe('test-id');
    expect(context.get('key')).toBe('value');
  });
  
  it('should deserialize with parent context', () => {
    const parent = new ContextImpl('parent-id', { parentKey: 'parentValue' });
    const parentMap = new Map<string, Context>();
    parentMap.set('parent-id', parent);
    
    const serialized = JSON.stringify({
      id: 'child-id',
      data: { childKey: 'childValue' },
      parentId: 'parent-id'
    });
    
    const child = ContextFactory.deserialize(serialized, parentMap);
    expect(child.parent).toBe(parent);
    expect(child.get('parentKey')).toBe('parentValue');
  });
});

describe('Global Context', () => {
  it('should create singleton instance', () => {
    const instance1 = GlobalContext.getInstance();
    const instance2 = GlobalContext.getInstance();
    expect(instance1).toBe(instance2);
  });
  
  it('should have default values', () => {
    const instance = GlobalContext.getInstance();
    expect(instance.has('appStartTime')).toBe(true);
  });
  
  it('should reset instance', () => {
    const instance1 = GlobalContext.getInstance();
    instance1.set('testKey', 'testValue');
    
    GlobalContext.reset();
    const instance2 = GlobalContext.getInstance();
    
    expect(instance2.has('testKey')).toBe(false);
    expect(instance2.has('appStartTime')).toBe(true);
  });
  
  it('should reset with initial data', () => {
    GlobalContext.reset({ customKey: 'customValue' });
    const instance = GlobalContext.getInstance();
    
    expect(instance.get('customKey')).toBe('customValue');
    expect(instance.has('appStartTime')).toBe(true);
  });
});

describe('Context Management', () => {
  // Basic context functionality
  describe('Basic Context Functionality', () => {
    it('should create a context with data', () => {
      const context = new ContextImpl('test', { key: 'value' });
      expect(context.id).toBe('test');
      expect(context.get('key')).toBe('value');
    });

    it('should set and get values', () => {
      const context = new ContextImpl();
      context.set('key', 'value');
      expect(context.get('key')).toBe('value');
    });

    it('should check if a key exists', () => {
      const context = new ContextImpl('test', { key: 'value' });
      expect(context.has('key')).toBe(true);
      expect(context.has('nonexistent')).toBe(false);
    });

    it('should return all keys', () => {
      const context = new ContextImpl('test', { key1: 'value1', key2: 'value2' });
      expect(context.keys()).toEqual(['key1', 'key2']);
    });

    it('should merge data', () => {
      const context = new ContextImpl('test', { key1: 'value1' });
      context.merge({ key2: 'value2', key3: 'value3' });
      expect(context.get('key1')).toBe('value1');
      expect(context.get('key2')).toBe('value2');
      expect(context.get('key3')).toBe('value3');
    });
  });

  // Parent-child context relationship
  describe('Parent-Child Context', () => {
    it('should create a child context', () => {
      const parent = new ContextImpl('parent', { parentKey: 'parentValue' });
      const child = parent.createChild({ childKey: 'childValue' });
      
      expect(child.parent).toBe(parent);
      expect(child.get('childKey')).toBe('childValue');
      expect(child.get('parentKey')).toBe('parentValue');
    });

    it('should resolve values from parent context', () => {
      const parent = new ContextImpl('parent', { shared: 'parent' });
      const child = parent.createChild({ local: 'child' });
      
      expect(child.get('local')).toBe('child');
      expect(child.get('shared')).toBe('parent');
      expect(parent.get('local')).toBeUndefined();
    });

    it('should override parent values in child context', () => {
      const parent = new ContextImpl('parent', { key: 'parent' });
      const child = parent.createChild({ key: 'child' });
      
      expect(child.get('key')).toBe('child');
      expect(parent.get('key')).toBe('parent');
    });

    it('should get all keys from context and parent', () => {
      const parent = new ContextImpl('parent', { parentKey: 'value', sharedKey: 'parent' });
      const child = parent.createChild({ childKey: 'value', sharedKey: 'child' });
      
      expect(child.keys()).toEqual(['childKey', 'sharedKey']);
      expect(child.allKeys()).toContain('childKey');
      expect(child.allKeys()).toContain('parentKey');
      expect(child.allKeys()).toContain('sharedKey');
      expect(child.allKeys().length).toBe(3);
    });
  });

  // Serialization and deserialization
  describe('Serialization and Deserialization', () => {
    it('should serialize a context to JSON', () => {
      const context = new ContextImpl('test', { key: 'value' });
      const serialized = context.serialize();
      
      expect(serialized).toContain('"id":"test"');
      expect(serialized).toContain('"key":"value"');
    });

    it('should deserialize a context from JSON', () => {
      const original = new ContextImpl('test', { key: 'value' });
      const serialized = original.serialize();
      const deserialized = ContextFactory.deserialize(serialized);
      
      expect(deserialized.id).toBe('test');
      expect(deserialized.get('key')).toBe('value');
    });

    it('should deserialize a context with parent context', () => {
      const parent = new ContextImpl('parent', { parentKey: 'parentValue' });
      const child = parent.createChild({ childKey: 'childValue' });
      const serialized = child.serialize();
      const deserialized = ContextFactory.deserialize(serialized);
      
      expect(deserialized.get('childKey')).toBe('childValue');
      expect(deserialized.get('parentKey')).toBe('parentValue');
      expect(deserialized.parent).toBeDefined();
      expect(deserialized.parent?.id).toBe('parent');
    });

    it('should update existing context through deserialization', () => {
      const context = new ContextImpl('test', { key1: 'value1', key2: 'value2' });
      
      context.deserialize({
        data: { key2: 'updated', key3: 'new' }
      });
      
      expect(context.get('key1')).toBe('value1');
      expect(context.get('key2')).toBe('updated');
      expect(context.get('key3')).toBe('new');
    });

    it('should handle parent context on deserialization', () => {
      const parent = new ContextImpl('parent', { parentKey: 'parentValue' });
      const child = parent.createChild({ childKey: 'childValue' });
      
      const updatedData = {
        data: { childKey: 'updated' },
        parent: {
          data: { parentKey: 'updated' }
        }
      };
      
      child.deserialize(updatedData, true);
      
      expect(child.get('childKey')).toBe('updated');
      expect(parent.get('parentKey')).toBe('updated');
    });
  });

  // Nested contexts
  describe('Nested Contexts', () => {
    it('should get a nested context by path', () => {
      const root = new ContextImpl('root');
      const levelA = root.createChild({ keyA: 'valueA' });
      root.set('levelA', levelA);
      
      const levelB = levelA.createChild({ keyB: 'valueB' });
      levelA.set('levelB', levelB);
      
      const nestedContext = root.getNestedContext('levelA.levelB');
      
      expect(nestedContext).toBeDefined();
      expect(nestedContext?.get('keyB')).toBe('valueB');
    });

    it('should create a nested context at a path', () => {
      const root = new ContextImpl('root');
      
      const nestedContext = root.createNestedContext('levelA.levelB', { key: 'value' });
      
      expect(nestedContext).toBeDefined();
      expect(nestedContext.get('key')).toBe('value');
      
      const retrievedContext = root.getNestedContext('levelA.levelB');
      expect(retrievedContext).toBe(nestedContext);
    });

    it('should create intermediary contexts when creating nested contexts', () => {
      const root = new ContextImpl('root');
      
      root.createNestedContext('level1.level2.level3', { key: 'value' });
      
      const level1 = root.get('level1');
      expect(level1).toBeDefined();
      
      const level2 = root.getNestedContext('level1.level2');
      expect(level2).toBeDefined();
      
      const level3 = root.getNestedContext('level1.level2.level3');
      expect(level3).toBeDefined();
      expect(level3?.get('key')).toBe('value');
    });
  });

  // Global context
  describe('Global Context', () => {
    it('should provide a singleton instance', () => {
      const instance1 = GlobalContext.getInstance();
      const instance2 = GlobalContext.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset the global context', () => {
      const before = GlobalContext.getInstance();
      before.set('testKey', 'testValue');
      
      GlobalContext.reset({ newKey: 'newValue' });
      
      const after = GlobalContext.getInstance();
      expect(after.get('testKey')).toBeUndefined();
      expect(after.get('newKey')).toBe('newValue');
      expect(after.get('appStartTime')).toBeDefined();
    });
  });
}); 