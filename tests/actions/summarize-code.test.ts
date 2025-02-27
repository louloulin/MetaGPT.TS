/**
 * Unit tests for SummarizeCode action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummarizeCode, SummaryLevel, ComponentType } from '../../src/actions/summarize-code';
import type { CodeSummary } from '../../src/actions/summarize-code';
import { UserMessage } from '../../src/types/message';

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

  beforeEach(() => {
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
    // Mock successful code summary
    const mockSummary: CodeSummary = {
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
          type: ComponentType.CLASS,
          description: 'Main authentication service class',
          location: 'src/services/auth.ts',
          dependencies: ['UserRepository', 'TokenService'],
          complexity: 0.7,
          lineCount: 80
        }
      ],
      functional_areas: [
        {
          name: 'Authentication',
          description: 'User login and session management',
          components: ['AuthService', 'TokenService']
        }
      ],
      design_patterns: [
        {
          name: 'Singleton',
          confidence: 0.9,
          description: 'Single instance of AuthService',
          location: 'src/services/auth.ts',
          benefits: ['Consistent state', 'Resource efficiency']
        }
      ],
      relationships: {
        imports: ['@types/jwt', '@types/bcrypt'],
        exports: ['AuthService', 'AuthConfig'],
        internal_dependencies: [
          {
            from: 'AuthService',
            to: 'UserRepository',
            type: 'USES'
          }
        ]
      },
      improvements: [
        {
          description: 'Add rate limiting',
          rationale: 'Prevent brute force attacks',
          priority: 'HIGH',
          implementation_difficulty: 'MODERATE',
          code_example: 'implement RateLimiter middleware'
        }
      ],
      documentation: {
        quality: 'GOOD',
        coverage_percentage: 85,
        missing_documentation: ['Error handling section'],
        suggestions: ['Add API documentation']
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
    expect(result.content).toContain('Design Patterns');
    expect(result.content).toContain('Improvements');
    expect(result.content).toContain('Documentation');
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
        level: SummaryLevel.BRIEF,
        expectedDetails: ['overview', 'primary purpose']
      },
      {
        level: SummaryLevel.STANDARD,
        expectedDetails: ['components', 'relationships']
      },
      {
        level: SummaryLevel.DETAILED,
        expectedDetails: ['design patterns', 'improvements', 'documentation']
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
      const mockSummary: CodeSummary = {
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
          type: ComponentType.CLASS,
          description: 'Test component'
        }],
        functional_areas: [{
          name: 'Testing',
          description: 'Test area',
          components: ['TestComponent']
        }],
        design_patterns: [{
          name: 'Observer',
          confidence: 0.8,
          description: 'Test pattern',
          benefits: ['Testability']
        }],
        relationships: {
          imports: ['test'],
          exports: ['TestComponent'],
          internal_dependencies: []
        },
        improvements: [{
          description: 'Test improvement',
          rationale: 'Better testing',
          priority: 'LOW',
          implementation_difficulty: 'EASY'
        }],
        documentation: {
          quality: 'GOOD',
          coverage_percentage: 90,
          missing_documentation: [],
          suggestions: []
        }
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
      const mockSummary: CodeSummary = {
        overview: {
          title: `${testCase.language} Code`,
          description: `Sample ${testCase.language} code`,
          language: testCase.language,
          primary_purpose: 'Testing',
          line_count: 1,
          estimated_complexity: 'LOW'
        },
        components: [],
        functional_areas: [],
        design_patterns: [],
        relationships: {
          imports: [],
          exports: [],
          internal_dependencies: []
        },
        improvements: [],
        documentation: {
          quality: 'ADEQUATE',
          coverage_percentage: 70,
          missing_documentation: [],
          suggestions: []
        }
      };

      mockLLM.chat.mockResolvedValue(JSON.stringify(mockSummary));

      // Add a message to process
      summarizeCode.context.memory.add(new UserMessage(`Summarize this ${testCase.language} code: ${testCase.code}`));

      // Run code summarization
      const result = await summarizeCode.run();

      // Verify language detection and handling
      expect(result.status).toBe('completed');
      expect(result.content).toContain(testCase.language);
      expect(result.content).toContain('Language:');
    }
  });
}); 