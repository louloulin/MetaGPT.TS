/**
 * Common utility functions used throughout the application
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * 将任意值转换为字符串
 * @param value 要转换的值
 * @returns 字符串表示
 */
export function anyToString(value: any): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return 'function: ' + (value.name || '(anonymous)');
  if (typeof value === 'object') {
    if (value instanceof Date) return 'Date: ' + value.toString();
    try {
      return value.toString() || JSON.stringify(value);
    } catch (e) {
      return Object.prototype.toString.call(value);
    }
  }
  return String(value);
}

/**
 * 将任意值转换为字符串集合
 * @param value 要转换的值
 * @returns 字符串集合
 */
export function anyToStringSet(value: any): Set<string> {
  if (value instanceof Set) {
    return new Set([...value].map(anyToString));
  }
  if (Array.isArray(value)) {
    return new Set(value.map(anyToString));
  }
  return new Set([anyToString(value)]);
}

/**
 * Generate a unique ID
 * @returns Unique ID string
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Sleep for a specified duration
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a value is null or undefined
 * @param value - Value to check
 * @returns True if the value is null or undefined
 */
export function isNullOrUndefined(value: any): boolean {
  return value === null || value === undefined;
}

/**
 * Safely parse JSON
 * @param text - JSON string to parse
 * @param defaultValue - Default value to return if parsing fails
 * @returns Parsed object or default value
 */
export function safeJsonParse<T>(text: string, defaultValue: T): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Truncate a string to a maximum length
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param initialDelay - Initial delay in milliseconds
 * @returns Promise that resolves with the function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = initialDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('Retry failed');
} 