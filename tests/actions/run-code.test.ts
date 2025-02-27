/**
 * Unit tests for RunCode action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunCode, ProgrammingLanguage } from '../../src/actions/run-code';
import type { ExecutionResult } from '../../src/actions/run-code';
import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UserMessage } from '../../src/types/message';

// Mock external dependencies
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM provider
const mockLLM = {
  chat: vi.fn(),
  getName: () => 'MockLLM',
  getModel: () => 'test-model',
  generate: vi.fn(),
};

// Mock EventEmitter for child process
class MockEventEmitter {
  private listeners: Record<string, Array<(...args: any[]) => void>> = {};
  
  on(event: string, listener: (...args: any[]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    return this;
  }
  
  emit(event: string, ...args: any[]) {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      for (const listener of eventListeners) {
        listener(...args);
      }
    }
    return !!eventListeners;
  }
}

// Mock spawn process
function createMockProcess() {
  const mockStdout = new MockEventEmitter();
  const mockStderr = new MockEventEmitter();
  const mockProcess = new MockEventEmitter() as any;
  
  mockProcess.stdout = mockStdout;
  mockProcess.stderr = mockStderr;
  mockProcess.connected = true;
  mockProcess.kill = vi.fn();
  
  return {
    mockProcess,
    mockStdout,
    mockStderr,
  };
}

describe('RunCode', () => {
  let runCode: RunCode;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create RunCode instance with mock LLM
    runCode = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
    });
  });
  
  it('should create a RunCode instance', () => {
    expect(runCode).toBeInstanceOf(RunCode);
    expect(runCode.name).toBe('RunCode');
  });
  
  it('should handle empty message list', async () => {
    const result = await runCode.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages available');
  });
  
  it('should execute JavaScript code successfully', async () => {
    // Mock successful execution
    const mockResult: ExecutionResult = {
      stdout: 'Hello, World!',
      stderr: '',
      exitCode: 0,
      executionTime: 100,
      success: true
    };

    // Mock the executeCode method
    (runCode as any).executeCode = vi.fn().mockResolvedValue(mockResult);

    // Add a message to process
    runCode.context.memory.add(new UserMessage('Run this code: console.log("Hello, World!");'));

    // Run code execution
    const result = await runCode.run();

    // Verify result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Code Execution Result');
    expect(result.content).toContain('Hello, World!');
    expect(result.content).toContain('Execution Time: 100ms');
    expect(result.content).toContain('Exit Code: 0');
  });
  
  it('should handle execution errors', async () => {
    // Mock failed execution
    const mockResult: ExecutionResult = {
      stdout: '',
      stderr: 'ReferenceError: x is not defined',
      exitCode: 1,
      executionTime: 50,
      success: false,
      error: 'Runtime error occurred'
    };

    // Mock the executeCode method
    (runCode as any).executeCode = vi.fn().mockResolvedValue(mockResult);

    // Add a message to process
    runCode.context.memory.add(new UserMessage('Run this code: console.log(x);'));

    // Run code execution
    const result = await runCode.run();

    // Verify error handling
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Error');
    expect(result.content).toContain('ReferenceError');
    expect(result.content).toContain('Exit Code: 1');
  });
  
  it('should respect execution configuration options', async () => {
    // Create instance with specific configuration
    const customRunCode = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
      args: {
        timeout: 5000,
        memoryLimit: 512,
        useContainer: true
      }
    });

    // Mock successful execution
    const mockResult: ExecutionResult = {
      stdout: 'Test output',
      stderr: '',
      exitCode: 0,
      executionTime: 200,
      success: true
    };

    // Mock the executeCode method
    (customRunCode as any).executeCode = vi.fn().mockResolvedValue(mockResult);

    // Add a message to process
    customRunCode.context.memory.add(new UserMessage('Run this code with custom config'));

    // Run code execution
    const result = await customRunCode.run();

    // Verify configuration was used
    expect((customRunCode as any).executeCode).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 5000,
        memoryLimit: 512,
        useContainer: true
      })
    );
  });
  
  it('should handle different programming languages', async () => {
    const testCases = [
      {
        language: ProgrammingLanguage.JAVASCRIPT,
        code: 'console.log("JS");',
        output: 'JS'
      },
      {
        language: ProgrammingLanguage.PYTHON,
        code: 'print("Python")',
        output: 'Python'
      },
      {
        language: ProgrammingLanguage.TYPESCRIPT,
        code: 'console.log("TS");',
        output: 'TS'
      }
    ];

    for (const testCase of testCases) {
      // Mock successful execution for each language
      const mockResult: ExecutionResult = {
        stdout: testCase.output,
        stderr: '',
        exitCode: 0,
        executionTime: 100,
        success: true
      };

      // Mock the executeCode method
      (runCode as any).executeCode = vi.fn().mockResolvedValue(mockResult);

      // Add a message to process
      runCode.context.memory.add(new UserMessage(`Run this ${testCase.language} code: ${testCase.code}`));

      // Run code execution
      const result = await runCode.run();

      // Verify language-specific handling
      expect(result.status).toBe('completed');
      expect(result.content).toContain(testCase.output);
      expect((runCode as any).executeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          language: testCase.language
        })
      );
    }
  });
  
  it('should clean up temporary files after execution', async () => {
    // Mock the cleanup method
    const mockCleanup = vi.fn();
    (runCode as any).cleanupTempDirectory = mockCleanup;

    // Mock successful execution
    const mockResult: ExecutionResult = {
      stdout: 'Test output',
      stderr: '',
      exitCode: 0,
      executionTime: 100,
      success: true
    };

    // Mock the executeCode method
    (runCode as any).executeCode = vi.fn().mockResolvedValue(mockResult);

    // Add a message to process
    runCode.context.memory.add(new UserMessage('Run this code'));

    // Run code execution
    await runCode.run();

    // Verify cleanup was called
    expect(mockCleanup).toHaveBeenCalled();
  });
}); 