/// <reference types="node" />
import { vi } from 'vitest';

declare global {
  var setTimeout: typeof setTimeout;
  var clearTimeout: typeof clearTimeout;
  var console: Console;
}

export async function setup() {
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
  if (typeof globalThis.setTimeout !== 'function') {
    globalThis.setTimeout = vi.fn() as unknown as typeof setTimeout;
  }
  
  if (typeof globalThis.clearTimeout !== 'function') {
    globalThis.clearTimeout = vi.fn() as unknown as typeof clearTimeout;
  }
  
  // Add any other necessary global setup
  globalThis.console = {
    ...console,
    // Silence console.log during tests
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  } as Console;
  
  // Return empty object to satisfy Vitest
  return {};
}

export async function teardown() {
  // Clean up environment variables
  delete process.env.OPENAI_API_KEY;
  delete process.env.SERPAPI_API_KEY;
  delete process.env.QWEN_API_KEY;
  delete process.env.QWEN_BASE_URL;
  delete process.env.QWEN_MODEL;
  
  // Clean up global test configuration
  delete (globalThis as any).__TEST__;
} 