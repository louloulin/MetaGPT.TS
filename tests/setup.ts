import { beforeAll, afterAll, afterEach, vi } from 'vitest';

beforeAll(() => {
  // 在所有测试开始前的全局设置
  vi.useFakeTimers();
});

afterAll(() => {
  // 在所有测试结束后的全局清理
  vi.useRealTimers();
});

afterEach(() => {
  // 每个测试后的清理
  vi.resetAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
}); 