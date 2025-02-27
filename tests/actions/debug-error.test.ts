import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebugError, ErrorType, ErrorSeverity } from '../../src/actions/debug-error';
import type { DebuggingResult } from '../../src/actions/debug-error';
import { UserMessage } from '../../src/types/message';
import { ProgrammingLanguage } from '../../src/actions/run-code';

describe('DebugError', () => {
  let mockLLM: any;
  let debugError: DebugError;

  beforeEach(() => {
    // Create mock LLM
    mockLLM = {
      chat: vi.fn(),
      getName: () => 'MockLLM',
      getModel: () => 'test-model',
      generate: vi.fn(),
    };

    // Create DebugError instance
    debugError = new DebugError({
      name: 'DebugError',
      llm: mockLLM,
    });
  });

  it('should create a DebugError instance', () => {
    expect(debugError).toBeInstanceOf(DebugError);
    expect(debugError.name).toBe('DebugError');
  });

  it('should handle empty message list', async () => {
    const result = await debugError.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages available');
  });

  it('should analyze and debug error successfully', async () => {
    // Mock successful LLM response
    const mockDebuggingResult: DebuggingResult = {
      error_analysis: {
        error_message: "TypeError: Cannot read property 'data' of undefined",
        error_type: ErrorType.REFERENCE,
        severity: ErrorSeverity.MAJOR,
        line_number: 42,
        column_number: 15,
        file_path: 'src/components/DataDisplay.tsx'
      },
      root_cause: {
        description: 'Attempting to access the data property on an undefined response object',
        technical_explanation: 'The API response is undefined when trying to access response.data, likely due to an unhandled error or asynchronous timing issue'
      },
      solutions: [
        {
          description: 'Add null check before accessing data property',
          code: 'if (response && response.data) {\n  // access data here\n}',
          explanation: 'This ensures data is only accessed when response exists',
          confidence: 0.95
        },
        {
          description: 'Use optional chaining operator',
          code: 'const data = response?.data;',
          explanation: 'Optional chaining operator returns undefined if response is null/undefined',
          confidence: 0.9
        }
      ],
      debugging_steps: [
        {
          order: 1,
          description: 'Add console logs to verify response object',
          code: 'console.log("API Response:", response);',
          expected_outcome: 'Verify response value before access attempt'
        },
        {
          order: 2,
          description: 'Implement error handling for API call',
          code: 'try {\n  const response = await api.getData();\n  return response?.data;\n} catch (error) {\n  console.error("API error:", error);\n  return null;\n}',
          expected_outcome: 'Proper error handling and graceful fallback'
        }
      ],
      validation: {
        fixed: true,
        execution_result: {
          stdout: 'Component rendered successfully',
          stderr: '',
          exitCode: 0,
          executionTime: 100,
          success: true
        }
      },
      resources: {
        documentation_links: [
          'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining',
          'https://reactjs.org/docs/error-boundaries.html'
        ],
        related_stack_overflow_questions: [
          'https://stackoverflow.com/questions/14782232/cannot-read-property-of-undefined'
        ]
      }
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockDebuggingResult));

    // Add a message to process
    debugError.context.memory.add(new UserMessage('Debug this error: TypeError: Cannot read property \'data\' of undefined'));

    // Run debugging
    const result = await debugError.run();

    // Verify result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Error Analysis');
    expect(result.content).toContain('Cannot read property \'data\' of undefined');
    expect(result.content).toContain('## Root Cause');
    expect(result.content).toContain('Attempting to access the data property on an undefined response object');
    expect(result.content).toContain('## Solutions');
    expect(result.content).toContain('Add null check before accessing data property');
    expect(result.content).toContain('## Debugging Steps');
    expect(result.content).toContain('1. Add console logs to verify response object');
    expect(result.content).toContain('## Validation');
    expect(result.content).toContain('Status: Fixed ✅');
  });

  it('should handle LLM response parsing error', async () => {
    // Mock LLM response with invalid JSON
    mockLLM.chat.mockResolvedValue('Invalid JSON response');

    // Add a message to process
    debugError.context.memory.add(new UserMessage('Debug this error: SyntaxError: Unexpected token'));

    // Run debugging
    const result = await debugError.run();

    // Verify fallback behavior
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Error Analysis');
    expect(result.content).toContain('SyntaxError: Unexpected token');
    expect(result.content).toContain('Basic analysis');
    expect(result.content).toContain('Potential Solutions');
  });

  it('should handle missing fields in LLM response', async () => {
    // Mock LLM response with missing fields
    const partialDebuggingResult = {
      error_analysis: {
        error_message: "ReferenceError: x is not defined",
        error_type: ErrorType.REFERENCE,
        severity: ErrorSeverity.MINOR
        // Missing other fields
      },
      // Missing other sections
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(partialDebuggingResult));

    // Add a message to process
    debugError.context.memory.add(new UserMessage('Debug this error: ReferenceError: x is not defined'));

    // Run debugging
    const result = await debugError.run();

    // Verify default values are used
    expect(result.status).toBe('completed');
    expect(result.content).toContain('ReferenceError: x is not defined');
    expect(result.content).toContain('Type: REFERENCE');
    expect(result.content).toContain('Root cause is unclear from the provided information');
  });

  it('should handle different error types and severities', async () => {
    // Mock debugging result with specific error type
    const mockDebuggingResult: DebuggingResult = {
      error_analysis: {
        error_message: "FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory",
        error_type: ErrorType.MEMORY,
        severity: ErrorSeverity.CRITICAL,
        file_path: 'server.js'
      },
      root_cause: {
        description: 'Application is consuming too much memory',
        technical_explanation: 'Memory leak or inefficient data processing is causing the Node.js process to exceed memory limits'
      },
      solutions: [
        {
          description: 'Increase Node.js memory limit',
          code: 'node --max-old-space-size=4096 server.js',
          explanation: 'Allocate more memory to the Node.js process',
          confidence: 0.7
        },
        {
          description: 'Fix memory leak',
          code: '// Look for event listeners not being removed\n// Check for large arrays or objects being retained\n// Investigate caching mechanisms',
          explanation: 'Identify and fix the source of memory leaks',
          confidence: 0.9
        }
      ],
      debugging_steps: [
        {
          order: 1,
          description: 'Use heap snapshot to find memory leaks',
          code: '// Use Chrome DevTools for Node.js\n// Run with --inspect flag',
          expected_outcome: 'Identify objects that are not being garbage collected'
        }
      ],
      validation: {
        fixed: false,
        remaining_issues: ['Need to identify specific memory leak source']
      },
      resources: {
        documentation_links: [
          'https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-megabytes',
          'https://developer.chrome.com/docs/devtools/memory-problems/'
        ]
      }
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockDebuggingResult));

    // Add a message to process
    debugError.context.memory.add(new UserMessage('Debug this error: FATAL ERROR: JavaScript heap out of memory'));

    // Run debugging
    const result = await debugError.run();

    // Verify error type and severity handling
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Error Analysis');
    expect(result.content).toContain('Type: MEMORY');
    expect(result.content).toContain('Severity: CRITICAL');
    expect(result.content).toContain('## Solutions');
    expect(result.content).toContain('Status: Not Fixed ❌');
  });

  it('should validate fixes and provide execution results', async () => {
    // Mock debugging result with validation
    const mockDebuggingResult: DebuggingResult = {
      error_analysis: {
        error_message: "TypeError: Cannot read property 'length' of null",
        error_type: ErrorType.REFERENCE,
        severity: ErrorSeverity.MAJOR,
        line_number: 15,
        file_path: 'src/utils/array-helpers.js'
      },
      root_cause: {
        description: 'Array is null when trying to access length property',
        technical_explanation: 'The array variable is null, likely because the function is called with null argument'
      },
      solutions: [
        {
          description: 'Add default empty array',
          code: 'function processArray(arr = []) {\n  return arr.length;\n}',
          explanation: 'Default parameter ensures array is never null',
          confidence: 0.95
        }
      ],
      debugging_steps: [
        {
          order: 1,
          description: 'Add null check',
          code: 'if (arr === null || arr === undefined) return 0;',
          expected_outcome: 'Return 0 for null arrays'
        }
      ],
      validation: {
        fixed: true,
        execution_result: {
          stdout: 'Test passed: array function now handles null inputs',
          stderr: '',
          exitCode: 0,
          executionTime: 100,
          success: true
        }
      },
      resources: {
        documentation_links: [
          'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters'
        ]
      }
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockDebuggingResult));

    // Add a message to process
    debugError.context.memory.add(new UserMessage('Debug this error: Cannot read property \'length\' of null'));

    // Run debugging
    const result = await debugError.run();

    // Verify validation results
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Error Analysis');
    expect(result.content).toContain('## Validation');
    expect(result.content).toContain('Status: Fixed ✅');
    expect(result.content).toContain('Test passed: array function now handles null inputs');
    expect(result.content).toContain('Exit Code: 0');
    expect(result.content).toContain('Execution Time: 100ms');
  });
}); 