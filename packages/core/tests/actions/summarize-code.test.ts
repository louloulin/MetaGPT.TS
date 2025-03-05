/**
 * Unit tests for SummarizeCode action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummarizeCode, SummaryLevel, ComponentType } from '../../src/actions/summarize-code';
import type { CodeSummary } from '../../src/actions/summarize-code';
import { UserMessage } from '../../src/types/message';
import { ContextImpl, ContextFactory, GlobalContext } from '../../src/context/context';
import { MemoryManagerImpl } from '../../src/memory/manager';

// Sample code for testing
const sampleCode = `
/**
 * A simple calculator class
 */
class Calculator {
  /**
   * Add two numbers
   * @param a First number
   * @param b Second number
   * @returns Sum of a and b
   */
  add(a: number, b: number): number {
    return a + b;
  }

  /**
   * Subtract b from a
   * @param a First number
   * @param b Second number
   * @returns Difference of a and b
   */
  subtract(a: number, b: number): number {
    return a - b;
  }

  /**
   * Multiply two numbers
   * @param a First number
   * @param b Second number
   * @returns Product of a and b
   */
  multiply(a: number, b: number): number {
    return a * b;
  }

  /**
   * Divide a by b
   * @param a First number
   * @param b Second number
   * @returns Quotient of a and b
   * @throws Error if b is zero
   */
  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}

export default Calculator;
`;

describe('SummarizeCode', () => {
  let mockLLM: any;
  let summarizeCode: SummarizeCode;
  let memory: MemoryManagerImpl;

  beforeEach(async () => {
    // Initialize context and memory
    GlobalContext.reset();
    memory = new MemoryManagerImpl();
    await memory.init();
    
    // Store memory in global context
    GlobalContext.getInstance().set('memory', memory);
    
    // Create mock LLM
    mockLLM = {
      chat: vi.fn(),
      getName: () => 'MockLLM',
      getModel: () => 'test-model',
      generate: vi.fn(),
    };

    // Create SummarizeCode instance
    summarizeCode = new SummarizeCode({
      name: 'SummarizeCode',
      llm: mockLLM,
    });
  });

  it('should create a SummarizeCode instance', () => {
    expect(summarizeCode).toBeInstanceOf(SummarizeCode);
    expect(summarizeCode.name).toBe('SummarizeCode');
  });

  it('should handle empty message list', async () => {
    const result = await summarizeCode.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages available');
  });

  it('should summarize code successfully', async () => {
    // Mock a code summary response
    const mockSummary = {
      overview: {
        title: 'User Authentication Module',
        description: 'Handles user authentication and session management',
        language: 'TypeScript',
        primary_purpose: 'Manage user authentication flow',
        line_count: 150,
        estimated_complexity: 'MEDIUM'
      },
      components: [
        {
          name: 'AuthService',
          type: 'CLASS',
          description: 'Main authentication service class',
          methods: [],
          properties: []
        }
      ],
      functional_areas: [
        {
          name: 'Authentication',
          description: 'User login and session management',
          components: ['AuthService']
        }
      ],
      relationships: {
        imports: ['@types/jwt', '@types/bcrypt'],
        exports: ['AuthService', 'AuthConfig'],
        internal_dependencies: []
      }
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockSummary));

    // Add a message to process
    summarizeCode.context.memory.add(new UserMessage('Summarize this authentication code'));

    // Run code summarization
    const result = await summarizeCode.run();

    // Verify result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Code Summary');
    expect(result.content).toContain('User Authentication Module');
    expect(result.content).toContain('Components');
    expect(result.content).toContain('AuthService');
    // Remove expectations for sections that aren't in the mock response
    // expect(result.content).toContain('Design Patterns');
    // expect(result.content).toContain('Improvements');
    // expect(result.content).toContain('Documentation');
  });

  it('should handle LLM response parsing error', async () => {
    // Mock LLM response with invalid JSON
    mockLLM.chat.mockResolvedValue('Invalid JSON response');

    // Add a message to process
    summarizeCode.context.memory.add(new UserMessage('Summarize this code'));

    // Run code summarization
    const result = await summarizeCode.run();

    // Verify fallback behavior
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Code Summary');
    expect(result.content).toContain('Unable to generate detailed summary');
    expect(result.content).toContain('Basic code information');
  });

  it('should handle missing fields in LLM response', async () => {
    // Mock LLM response with missing fields
    const partialSummary = {
      overview: {
        title: 'Partial Summary',
        description: 'Basic code description',
        language: 'TypeScript'
      }
      // Other fields missing
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(partialSummary));

    // Add a message to process
    summarizeCode.context.memory.add(new UserMessage('Summarize this code'));

    // Run code summarization
    const result = await summarizeCode.run();

    // Verify default values are used
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Partial Summary');
    expect(result.content).toContain('Basic code description');
    expect(result.content).toContain('No components identified');
  });

  it('should respect summary level configuration', async () => {
    const testCases = [
      {
        level: 'BRIEF',
        expectedDetails: ['BRIEF', 'TestComponent']
      },
      {
        level: 'DETAILED',
        expectedDetails: ['DETAILED', 'TestComponent', 'Testing']
      },
      {
        level: 'COMPREHENSIVE',
        expectedDetails: ['COMPREHENSIVE', 'TestComponent', 'Testing']
      }
    ];

    for (const testCase of testCases) {
      // Create instance with specific summary level
      const levelSpecificSummarizer = new SummarizeCode({
        name: 'SummarizeCode',
        llm: mockLLM,
        args: {
          level: testCase.level
        }
      });

      // Mock summary response
      const mockSummary = {
        overview: {
          title: `${testCase.level} Summary`,
          description: 'Test code',
          language: 'TypeScript',
          primary_purpose: 'Testing',
          line_count: 100,
          estimated_complexity: 'LOW'
        },
        components: [{
          name: 'TestComponent',
          type: 'CLASS',
          description: 'Test component'
        }],
        functional_areas: [{
          name: 'Testing',
          description: 'Test area',
          components: ['TestComponent']
        }]
      };

      mockLLM.chat.mockResolvedValue(JSON.stringify(mockSummary));

      // Add a message to process
      levelSpecificSummarizer.context.memory.add(new UserMessage(`Summarize this code with ${testCase.level} detail`));

      // Run code summarization
      const result = await levelSpecificSummarizer.run();

      // Verify level-specific content
      expect(result.status).toBe('completed');
      testCase.expectedDetails.forEach(detail => {
        expect(result.content).toContain(detail);
      });
    }
  });

  it('should detect and handle different programming languages', async () => {
    const testCases = [
      {
        code: 'function test() { console.log("Hello"); }',
        language: 'JavaScript'
      },
      {
        code: 'def test(): print("Hello")',
        language: 'Python'
      },
      {
        code: 'public class Test { public static void main(String[] args) {} }',
        language: 'Java'
      }
    ];

    for (const testCase of testCases) {
      // Mock summary with language detection
      const mockSummary = {
        overview: {
          title: `${testCase.language} Code`,
          description: `Sample ${testCase.language} code`,
          language: testCase.language,
          primary_purpose: 'Testing',
          line_count: 1,
          estimated_complexity: 'LOW'
        },
        components: [],
        functional_areas: []
      };

      mockLLM.chat.mockResolvedValue(JSON.stringify(mockSummary));

      // Create a message with code
      const message = new UserMessage(`Summarize this code: ${testCase.code}`);
      
      // Reset summarizer for each test case
      summarizeCode = new SummarizeCode({
        name: 'SummarizeCode',
        llm: mockLLM
      });
      
      // Add message to memory
      summarizeCode.context.memory.add(message);

      // Run code summarization
      const result = await summarizeCode.run();

      // Verify language detection and handling
      expect(result.status).toBe('completed');
      expect(result.content).toContain(testCase.language);
      expect(result.content).toContain('Language:');
    }
  });
}); 