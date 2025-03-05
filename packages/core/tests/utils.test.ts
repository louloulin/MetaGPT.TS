import { describe, expect, test } from 'bun:test';
import { anyToString, anyToStringSet, delay, retry } from '../src/utils/common';

describe('Utility Functions', () => {
  describe('anyToString', () => {
    test('should convert various types to string', () => {
      expect(anyToString('test')).toBe('test');
      expect(anyToString(123)).toBe('123');
      expect(anyToString(null)).toBe('null');
      expect(anyToString(undefined)).toBe('undefined');
      expect(anyToString(() => {})).toMatch(/function/);
      expect(anyToString(new Date())).toMatch(/Date/);
    });
  });

  describe('anyToStringSet', () => {
    test('should convert array to Set of strings', () => {
      const result = anyToStringSet(['test', 123, null]);
      expect(result instanceof Set).toBe(true);
      expect(result.size).toBe(3);
      expect(result.has('test')).toBe(true);
      expect(result.has('123')).toBe(true);
      expect(result.has('null')).toBe(true);
    });

    test('should convert Set to Set of strings', () => {
      const input = new Set(['test', 123]);
      const result = anyToStringSet(input);
      expect(result instanceof Set).toBe(true);
      expect(result.size).toBe(2);
      expect(result.has('test')).toBe(true);
      expect(result.has('123')).toBe(true);
    });

    test('should convert single value to Set with one string', () => {
      const result = anyToStringSet(123);
      expect(result instanceof Set).toBe(true);
      expect(result.size).toBe(1);
      expect(result.has('123')).toBe(true);
    });
  });

  describe('delay', () => {
    test('should delay execution', async () => {
      const start = Date.now();
      await delay(100);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(90); // Allow some margin
    });
  });

  describe('retry', () => {
    test('should retry failed operations', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) throw new Error('Fail');
        return 'success';
      };

      const result = await retry(fn, 3, 100);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should throw after max retries', async () => {
      const fn = async () => {
        throw new Error('Always fail');
      };

      await expect(retry(fn, 2, 100)).rejects.toThrow('Always fail');
    });
  });
}); 