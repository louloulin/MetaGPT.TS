/// <reference types="node" />
import { vi, afterAll } from 'vitest';

// Set environment variables
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'your-api-key-here'; // 替换为你的 API key
process.env.SERPAPI_API_KEY = 'test-key';

// Set Qwen LLM configuration
process.env.QWEN_API_KEY = 'your-api-key-here'; // 替换为你的 API key
process.env.QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
process.env.QWEN_MODEL = 'qwen-plus-2025-01-25';

// Set global test configuration
(globalThis as any).__TEST__ = true;

// Mock global objects that might be used in tests
const mockSetTimeout = vi.fn();
const mockClearTimeout = vi.fn();

if (typeof globalThis.setTimeout !== 'function') {
  (globalThis as any).setTimeout = mockSetTimeout;
}

if (typeof globalThis.clearTimeout !== 'function') {
  (globalThis as any).clearTimeout = mockClearTimeout;
}

// Add any other necessary global setup
(globalThis as any).console = {
  ...console,
  // Silence console.log during tests
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

// Clean up function
afterAll(() => {
  // Clean up environment variables
  delete process.env.OPENAI_API_KEY;
  delete process.env.SERPAPI_API_KEY;
  delete process.env.QWEN_API_KEY;
  delete process.env.QWEN_BASE_URL;
  delete process.env.QWEN_MODEL;
  
  // Clean up global test configuration
  delete (globalThis as any).__TEST__;
}); 