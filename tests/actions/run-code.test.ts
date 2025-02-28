/**
 * Unit tests for RunCode action
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RunCode, ProgrammingLanguage } from '../../src/actions/run-code';
import type { ExecutionResult } from '../../src/actions/run-code';
import type { Context } from '../../src/context/context';
import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MemoryManagerImpl } from '../../src/memory/memory-manager';
import { ContextImpl, ContextFactory, GlobalContext } from '../../src/context/context';
import type { Message } from '../../src/types/message';
import type { LLMProvider } from '../../src/types/llm';
import type { ActionConfig } from '../../src/types/action';
import { v4 as uuidv4 } from 'uuid';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import { UserMessage } from '../../src/types/message';
import type { MemoryManager } from '../../src/types/memory';
import { ArrayMemory } from '../../src/memory/array';

// Mock fs/promises
const mockFs = {
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  access: vi.fn(),
};

vi.mock('fs/promises', () => mockFs);

// Mock child_process
const mockExec = vi.fn();
vi.mock('child_process', () => ({
  exec: mockExec,
}));

// Mock path
vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
  dirname: (path: string) => path.split('/').slice(0, -1).join('/'),
}));

// Mock context and memory
const mockContext: Context = {
  id: 'test',
  parent: undefined,
  data: {},
  llm: undefined,
  memory: undefined,
  get: vi.fn(),
  set: vi.fn(),
  createChild: vi.fn(),
  serialize: vi.fn(),
  deserialize: vi.fn(),
  has: vi.fn(),
  keys: vi.fn(),
  allKeys: vi.fn(),
  merge: vi.fn(),
  getNestedContext: vi.fn(),
  createNestedContext: vi.fn(),
};

describe('RunCode', () => {
  let runCode: RunCode;
  let memory: MemoryManager;
  let llmProvider: LLMProvider;

  beforeEach(async () => {
    llmProvider = createTestLLMProvider();
    memory = new MemoryManagerImpl();
    await memory.init();
    runCode = new RunCode({
      name: 'RunCode',
      description: 'Run code and return results',
      llm: llmProvider,
      memory
    });
    vi.resetAllMocks();
  });

  afterEach(async () => {
    console.log('Test cleanup: Clearing mocks and memory');
    vi.clearAllMocks();
    await memory.clear();
    GlobalContext.reset();
  });
  
  it('should create a RunCode instance', () => {
    expect(runCode).toBeInstanceOf(RunCode);
    expect(runCode.name).toBe('RunCode');
  });
  
  it('should handle empty message list', async () => {
    const result = await runCode.run();
    expect(result.status).toBe('failed');
    expect(result.content).toBe('No messages available');
  });
  
  it('should execute JavaScript code successfully', async () => {
    const message: Message = {
      id: uuidv4(),
      content: JSON.stringify({
        code: 'console.log("Hello, World!");',
        language: ProgrammingLanguage.JAVASCRIPT,
      }),
      role: 'user',
      causedBy: 'UserRequirement',
      sentFrom: '',
      timestamp: new Date().toISOString(),
      sendTo: new Set(['*']),
    };
    await memory.add(message);

    const result = await runCode.run();
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Code Execution Result');
    expect(result.content).toContain('Hello, World!');
    expect(fs.writeFile).toHaveBeenCalled();
  });
  
  it.skip('should handle execution errors', async () => {
    const message: Message = {
      id: uuidv4(),
      content: JSON.stringify({
        code: 'console.log(undefinedVariable);',
        language: ProgrammingLanguage.JAVASCRIPT,
      }),
      role: 'user',
      causedBy: 'UserRequirement',
      sentFrom: '',
      timestamp: new Date().toISOString(),
      sendTo: new Set(['*']),
    };
    await memory.add(message);

    const result = await runCode.run();
    console.log('Error test result:', result);
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Error');
    expect(fs.writeFile).toHaveBeenCalled();
  });
  
  it.skip('should handle different programming languages', async () => {
    const testCases = [
      {
        language: ProgrammingLanguage.JAVASCRIPT,
        code: 'console.log("Hello from JavaScript");',
        output: 'Hello from JavaScript',
      },
      {
        language: ProgrammingLanguage.PYTHON,
        code: 'print("Hello from Python")',
        output: 'Hello from Python',
      },
      {
        language: ProgrammingLanguage.TYPESCRIPT,
        code: 'console.log("Hello from TypeScript");',
        output: 'Hello from TypeScript',
      },
    ];

    for (const testCase of testCases) {
      console.log('Testing language:', testCase.language);
      const message: Message = {
        id: uuidv4(),
        content: JSON.stringify({
          code: testCase.code,
          language: testCase.language,
        }),
        role: 'user',
        causedBy: 'UserRequirement',
        sentFrom: '',
        timestamp: new Date().toISOString(),
        sendTo: new Set(['*']),
      };
      console.log('Adding message to memory:', { 
        messageId: message.id,
        content: message.content 
      });
      await memory.add(message);

      const result = await runCode.run();
      console.log('Test result:', { 
        status: result.status,
        content: result.content,
        expectedOutput: testCase.output 
      });
      expect(result.status).toBe('completed');
      expect(result.content).toContain(testCase.output);
      expect(fs.writeFile).toHaveBeenCalled();

      // Clear memory for next test
      console.log('Clearing memory for next test');
      await memory.clear();
    }
  });
  
  it('should clean up temporary files after execution', async () => {
    const message: Message = {
      id: uuidv4(),
      content: JSON.stringify({
        code: 'console.log("test");',
        language: ProgrammingLanguage.JAVASCRIPT,
      }),
      role: 'user',
      causedBy: 'UserRequirement',
      sentFrom: '',
      timestamp: new Date().toISOString(),
      sendTo: new Set(['*']),
    };
    await memory.add(message);

    await runCode.run();
    expect(fs.rm).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should initialize correctly', () => {
    expect(runCode.name).toBe('RunCode');
  });

  it('should run TypeScript code successfully', async () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
      console.log(add(2, 3));
    `;

    mockExec.mockImplementation((cmd: string, opts: any, callback: Function) => {
      callback(null, { stdout: '5\n', stderr: '' });
    });

    // Add message to memory
    const message = new UserMessage(`Run this code: ${code}`);
    await memory.add(message);

    const result = await runCode.run();
    expect(result.status).toBe('completed');
    expect(result.content).toContain('5');
  });

  it('should handle syntax errors', async () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      // Missing closing brace
    `;

    mockExec.mockImplementation((cmd: string, opts: any, callback: Function) => {
      callback(new Error('Syntax error'), { stdout: '', stderr: 'Syntax error' });
    });

    // Add message to memory
    const message = new UserMessage(`Run this code: ${code}`);
    await memory.add(message);

    const result = await runCode.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('error');
  });

  it('should handle runtime errors', async () => {
    const code = `
      function divide(a: number, b: number): number {
        return a / b;
      }
      console.log(divide(5, 0));
    `;

    mockExec.mockImplementation((cmd: string, opts: any, callback: Function) => {
      callback(new Error('Division by zero'), { stdout: '', stderr: 'Division by zero' });
    });

    // Add message to memory
    const message = new UserMessage(`Run this code: ${code}`);
    await memory.add(message);

    const result = await runCode.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('error');
  });

  it('should handle empty code input', async () => {
    // Add empty message to memory
    const message = new UserMessage('Run this code:');
    await memory.add(message);

    const result = await runCode.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No valid code found in message');
  });
}); 