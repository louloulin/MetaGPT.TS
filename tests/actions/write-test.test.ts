import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteTest } from '../../src/actions/write-test';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import type { LLMProvider } from '../../src/types/llm';

describe('WriteTest Action', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    llmProvider = createTestLLMProvider();
  });

  it('should generate tests when given code', async () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const writeTest = new WriteTest({
      name: 'WriteTest',
      description: 'Generate test cases for code',
      llm: llmProvider,
      code,
      language: 'typescript'
    });

    const result = await writeTest.run();

    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.content).toContain('test');
    expect(result.content).toContain('expect');
  });

  it('should fail when no code is provided', async () => {
    const writeTest = new WriteTest({
      name: 'WriteTest',
      description: 'Generate test cases for code',
      llm: llmProvider,
      language: 'typescript'
    });

    const result = await writeTest.run();

    expect(result.status).toBe('failed');
    expect(result.content).toContain('No code provided');
  });

  it('should handle different programming languages', async () => {
    const pythonCode = `
      def multiply(a, b):
          return a * b
    `;

    const writeTest = new WriteTest({
      name: 'WriteTest',
      description: 'Generate test cases for code',
      llm: llmProvider,
      code: pythonCode,
      language: 'python'
    });

    const result = await writeTest.run();

    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.content).toContain('test');
    expect(result.content).toContain('assert');
  });

  it('should include test coverage requirements', async () => {
    const code = `
      function divide(a: number, b: number): number {
        if (b === 0) throw new Error('Division by zero');
        return a / b;
      }
    `;

    const writeTest = new WriteTest({
      name: 'WriteTest',
      description: 'Generate test cases for code',
      llm: llmProvider,
      code,
      language: 'typescript',
      coverage: 'high'
    });

    const result = await writeTest.run();

    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.content).toContain('test');
    expect(result.content).toContain('throw');
  });
}); 