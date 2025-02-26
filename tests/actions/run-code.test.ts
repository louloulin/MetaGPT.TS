/**
 * Unit tests for RunCode action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunCode, ProgrammingLanguage } from '../../src/actions/run-code';
import type { ExecutionResult } from '../../src/actions/run-code';
import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  });
  
  it('should fail when no code is provided', async () => {
    // Run the action without providing code
    const result = await runCode.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No code provided for execution');
  });
  
  it('should execute JavaScript code natively', async () => {
    // Mock values
    const jsCode = 'console.log("Hello, world!");';
    const mockOutput = 'Hello, world!';
    
    // Setup mock process
    const { mockProcess, mockStdout } = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess);
    
    // Create RunCode instance with code
    const codeRunner = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
      args: {
        code: jsCode,
        language: ProgrammingLanguage.JAVASCRIPT,
      },
    });
    
    // Start executing the code (in background)
    const resultPromise = codeRunner.run();
    
    // Emit output and completion events
    mockStdout.emit('data', Buffer.from(mockOutput));
    mockProcess.emit('close', 0); // Exit code 0 = success
    
    // Wait for execution to complete
    const result = await resultPromise;
    
    // Verify that the code was executed correctly
    expect(result.status).toBe('completed');
    expect(result.content).toContain('SUCCESS');
    expect(result.content).toContain(mockOutput);
    
    // Verify that a temporary file was created with the correct extension
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.js'),
      jsCode,
      'utf-8'
    );
    
    // Verify that Node.js was used to execute the JavaScript code
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining([expect.stringContaining('code.js')]),
      expect.anything()
    );
  });
  
  it('should execute Python code natively', async () => {
    // Mock values
    const pythonCode = 'print("Hello, Python!")';
    const mockOutput = 'Hello, Python!';
    
    // Setup mock process
    const { mockProcess, mockStdout } = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess);
    
    // Create RunCode instance with code
    const codeRunner = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
      args: {
        code: pythonCode,
        language: ProgrammingLanguage.PYTHON,
      },
    });
    
    // Start executing the code (in background)
    const resultPromise = codeRunner.run();
    
    // Emit output and completion events
    mockStdout.emit('data', Buffer.from(mockOutput));
    mockProcess.emit('close', 0);
    
    // Wait for execution to complete
    const result = await resultPromise;
    
    // Verify that the code was executed correctly
    expect(result.status).toBe('completed');
    expect(result.content).toContain('SUCCESS');
    expect(result.content).toContain(mockOutput);
    
    // Verify that Python was used to execute the code
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'python',
      expect.arrayContaining([expect.stringContaining('.py')]),
      expect.anything()
    );
  });
  
  it('should handle execution errors', async () => {
    // Mock values
    const errorCode = 'console.log(undefinedVariable);';
    const mockError = 'ReferenceError: undefinedVariable is not defined';
    
    // Setup mock process
    const { mockProcess, mockStderr } = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess);
    
    // Create RunCode instance with code that will cause an error
    const codeRunner = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
      args: {
        code: errorCode,
        language: ProgrammingLanguage.JAVASCRIPT,
      },
    });
    
    // Start executing the code (in background)
    const resultPromise = codeRunner.run();
    
    // Emit error output and fail execution
    mockStderr.emit('data', Buffer.from(mockError));
    mockProcess.emit('close', 1); // Exit code 1 = error
    
    // Wait for execution to complete
    const result = await resultPromise;
    
    // Verify that the error was handled correctly
    expect(result.status).toBe('failed');
    expect(result.content).toContain('FAILURE');
    expect(result.content).toContain(mockError);
  });
  
  it('should handle execution timeouts', async () => {
    // Mock values
    const infiniteLoopCode = 'while(true) {}';
    
    // Setup mock process
    const { mockProcess } = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess);
    
    // Mock setTimeout to trigger immediately
    const originalSetTimeout = setTimeout;
    vi.stubGlobal('setTimeout', vi.fn().mockImplementation((callback: () => void) => {
      callback();
      return 1 as any;
    }));
    
    // Create RunCode instance with infinite loop code
    const codeRunner = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
      args: {
        code: infiniteLoopCode,
        language: ProgrammingLanguage.JAVASCRIPT,
        timeout: 5000, // 5 seconds timeout (mocked)
      },
    });
    
    // Execute the code
    const result = await codeRunner.run();
    
    // Restore setTimeout
    vi.stubGlobal('setTimeout', originalSetTimeout);
    
    // Verify that timeout was handled correctly
    expect(result.content).toContain('FAILURE');
    expect(result.content).toContain('Execution timed out');
    expect(mockProcess.kill).toHaveBeenCalled();
  });
  
  it('should capture and return all output types', async () => {
    // Mock values
    const complexCode = 'console.log("stdout"); console.error("stderr");';
    
    // Setup mock process
    const { mockProcess, mockStdout, mockStderr } = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess);
    
    // Create RunCode instance
    const codeRunner = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
      args: {
        code: complexCode,
        language: ProgrammingLanguage.JAVASCRIPT,
      },
    });
    
    // Start executing the code (in background)
    const resultPromise = codeRunner.run();
    
    // Emit stdout and stderr output
    mockStdout.emit('data', Buffer.from('stdout'));
    mockStderr.emit('data', Buffer.from('stderr'));
    mockProcess.emit('close', 0);
    
    // Wait for execution to complete
    const result = await resultPromise;
    
    // Verify that both stdout and stderr were captured
    expect(result.content).toContain('Standard Output');
    expect(result.content).toContain('stdout');
    expect(result.content).toContain('Standard Error');
    expect(result.content).toContain('stderr');
  });
  
  it('should handle process errors', async () => {
    // Mock values
    const code = 'console.log("This will never run");';
    const errorMessage = 'Command not found';
    
    // Setup mock process
    const { mockProcess } = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess);
    
    // Create RunCode instance
    const codeRunner = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
      args: {
        code,
        language: 'unknown', // Using unknown language to force error
      },
    });
    
    // Start executing the code (in background)
    const resultPromise = codeRunner.run();
    
    // Emit process error
    mockProcess.emit('error', new Error(errorMessage));
    
    // Wait for execution to complete
    const result = await resultPromise;
    
    // Verify that process error was handled correctly
    expect(result.status).toBe('failed');
    expect(result.content).toContain('FAILURE');
    expect(result.content).toContain(errorMessage);
  });
  
  it('should accept custom environment variables', async () => {
    // Mock values
    const code = 'console.log(process.env.TEST_VAR);';
    
    // Setup mock process
    const { mockProcess, mockStdout } = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess);
    
    // Custom environment variables
    const customEnv = {
      TEST_VAR: 'test_value',
    };
    
    // Create RunCode instance with custom environment
    const codeRunner = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
      args: {
        code,
        language: ProgrammingLanguage.JAVASCRIPT,
        env: customEnv,
      },
    });
    
    // Start executing the code
    const resultPromise = codeRunner.run();
    
    // Emit output and completion events
    mockStdout.emit('data', Buffer.from('test_value'));
    mockProcess.emit('close', 0);
    
    // Wait for execution to complete
    await resultPromise;
    
    // Verify that custom environment variables were passed
    expect(childProcess.spawn).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        env: expect.objectContaining(customEnv),
      })
    );
  });
  
  it('should clean up temporary files after execution', async () => {
    // Mock values
    const code = 'console.log("Cleanup test");';
    
    // Setup mock process
    const { mockProcess } = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess);
    
    // Create RunCode instance
    const codeRunner = new RunCode({
      name: 'RunCode',
      llm: mockLLM,
      args: {
        code,
        language: ProgrammingLanguage.JAVASCRIPT,
      },
    });
    
    // Start executing the code
    const resultPromise = codeRunner.run();
    
    // Complete execution
    mockProcess.emit('close', 0);
    
    // Wait for execution to complete
    await resultPromise;
    
    // Verify that temporary directory was removed
    expect(fs.rm).toHaveBeenCalledWith(
      expect.stringContaining('runcode-'),
      expect.objectContaining({
        recursive: true,
        force: true,
      })
    );
  });
}); 