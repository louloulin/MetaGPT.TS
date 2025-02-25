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
 * 生成唯一ID
 * @returns UUID字符串
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 延迟执行
 * @param ms 延迟毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数执行
 * @param fn 要执行的函数
 * @param retries 重试次数
 * @param delay 重试延迟(ms)
 * @returns Promise
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await delay(delayMs);
    return retry(fn, retries - 1, delayMs);
  }
} 