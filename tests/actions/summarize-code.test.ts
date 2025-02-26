/**
 * Unit tests for SummarizeCode action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummarizeCode, SummaryLevel, ComponentType } from '../../src/actions/summarize-code';
import type { CodeSummary } from '../../src/actions/summarize-code';

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

// Mock LLM provider
const mockLLM = {
  chat: vi.fn(),
  getName: () => 'MockLLM',
  getModel: () => 'test-model',
  generate: vi.fn(),
  ask: vi.fn().mockImplementation(async (prompt: string) => {
    // Mock response for code summary
    if (prompt.includes('Calculator')) {
      return JSON.stringify({
        overview: {
          title: "Calculator Class Implementation",
          description: "A simple calculator class that provides basic arithmetic operations.",
          language: "TypeScript",
          primary_purpose: "Perform basic mathematical operations",
          line_count: 42,
          estimated_complexity: "LOW"
        },
        components: [
          {
            name: "Calculator",
            type: "CLASS",
            description: "Main calculator class with arithmetic methods",
            location: "calculator.ts",
            complexity: 1,
            lineCount: 40
          },
          {
            name: "add",
            type: "FUNCTION",
            description: "Adds two numbers together",
            location: "calculator.ts:10-12",
            complexity: 1,
            lineCount: 3
          },
          {
            name: "subtract",
            type: "FUNCTION",
            description: "Subtracts second number from first",
            location: "calculator.ts:20-22",
            complexity: 1,
            lineCount: 3
          },
          {
            name: "multiply",
            type: "FUNCTION",
            description: "Multiplies two numbers",
            location: "calculator.ts:30-32",
            complexity: 1,
            lineCount: 3
          },
          {
            name: "divide",
            type: "FUNCTION",
            description: "Divides first number by second with zero check",
            location: "calculator.ts:40-45",
            complexity: 2,
            lineCount: 6
          }
        ],
        functional_areas: [
          {
            name: "Arithmetic Operations",
            description: "Basic arithmetic operations for a calculator",
            components: ["add", "subtract", "multiply", "divide"]
          }
        ],
        design_patterns: [
          {
            name: "Simple Class Pattern",
            confidence: 0.9,
            description: "Uses a simple class structure to encapsulate related functionality",
            benefits: ["Encapsulation", "Organization", "Reusability"]
          }
        ],
        relationships: {
          imports: [],
          exports: ["Calculator"],
          internal_dependencies: []
        },
        improvements: [
          {
            description: "Add input validation",
            rationale: "Prevent unexpected behavior with invalid inputs",
            priority: "MEDIUM",
            implementation_difficulty: "EASY",
            code_example: "if (typeof a !== 'number' || typeof b !== 'number') {\n  throw new Error('Inputs must be numbers');\n}"
          },
          {
            description: "Implement additional operations",
            rationale: "Expand functionality to include more mathematical operations",
            priority: "LOW",
            implementation_difficulty: "EASY"
          }
        ],
        documentation: {
          quality: "GOOD",
          coverage_percentage: 90,
          missing_documentation: ["Calculator class could have more detailed description"],
          suggestions: ["Add more examples", "Include usage instructions"]
        }
      });
    } 
    // Mock response for invalid JSON case
    else if (prompt.includes('invalid json')) {
      return 'This is not valid JSON';
    }
    // Default fallback response
    else {
      return JSON.stringify({
        overview: {
          title: "Generic Code",
          description: "Some code",
          language: "Unknown",
          primary_purpose: "Unknown",
          line_count: 10,
          estimated_complexity: "LOW"
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
          quality: "POOR",
          coverage_percentage: 0,
          missing_documentation: ["Everything"],
          suggestions: ["Add documentation"]
        }
      });
    }
  })
};

describe('SummarizeCode', () => {
  let summarizeCode: SummarizeCode;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create SummarizeCode instance with mock LLM
    summarizeCode = new SummarizeCode({
      name: 'SummarizeCode',
      llm: mockLLM,
    });
    
    // Setup the ask method from BaseAction
    (summarizeCode as any).ask = mockLLM.ask;
  });
  
  it('should create a SummarizeCode instance', () => {
    expect(summarizeCode).toBeInstanceOf(SummarizeCode);
  });
  
  it('should fail when no code is provided', async () => {
    // Run the action without providing code
    const result = await summarizeCode.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No code provided for summarization');
  });
  
  it('should analyze calculator code and generate a summary', async () => {
    // Create SummarizeCode instance with calculator code
    const codeSummarizer = new SummarizeCode({
      name: 'SummarizeCode',
      llm: mockLLM,
      args: {
        code: sampleCode,
        language: 'TypeScript',
        file_path: 'calculator.ts'
      }
    });
    
    // Setup the ask method from BaseAction
    (codeSummarizer as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await codeSummarizer.run();
    
    // Verify that code was analyzed correctly
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Calculator Class Implementation');
    expect(result.content).toContain('Arithmetic Operations');
    expect(result.content).toContain('Add input validation');
    
    // Verify that the instructContent contains the CodeSummary
    const summary = result.instructContent as CodeSummary;
    expect(summary.overview.language).toBe('TypeScript');
    expect(summary.components.length).toBe(5);
    expect(summary.functional_areas.length).toBe(1);
    expect(summary.design_patterns.length).toBe(1);
    expect(summary.improvements.length).toBe(2);
  });
  
  it('should handle LLM response parsing errors gracefully', async () => {
    // Create SummarizeCode instance with code that will trigger invalid JSON response
    const codeSummarizer = new SummarizeCode({
      name: 'SummarizeCode',
      llm: mockLLM,
      args: {
        code: 'This will trigger invalid json response',
        language: 'Unknown'
      }
    });
    
    // Setup the ask method from BaseAction
    (codeSummarizer as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await codeSummarizer.run();
    
    // Verify that a fallback summary was created
    expect(result.status).toBe('completed');
    expect(result.content).toContain('This is a basic fallback summary');
    
    // Verify that the instructContent contains the fallback CodeSummary
    const summary = result.instructContent as CodeSummary;
    expect(summary.overview.title).toContain('Unknown Code');
  });
  
  it('should detect language from code if not provided', async () => {
    // Create a spy for the detectLanguage method
    const detectLanguageSpy = vi.spyOn(SummarizeCode.prototype as any, 'detectLanguage');
    detectLanguageSpy.mockReturnValue('TypeScript');
    
    // Create SummarizeCode instance without specifying language
    const codeSummarizer = new SummarizeCode({
      name: 'SummarizeCode',
      llm: mockLLM,
      args: {
        code: sampleCode
      }
    });
    
    // Setup the ask method from BaseAction
    (codeSummarizer as any).ask = mockLLM.ask;
    
    // Execute the action
    await codeSummarizer.run();
    
    // Verify that language detection was called
    expect(detectLanguageSpy).toHaveBeenCalled();
  });
  
  it('should respect summary level options', async () => {
    // Create SummarizeCode instances with different summary levels
    const briefSummarizer = new SummarizeCode({
      name: 'SummarizeCode',
      llm: mockLLM,
      args: {
        code: sampleCode,
        language: 'TypeScript',
        options: {
          level: SummaryLevel.BRIEF
        }
      }
    });
    
    const detailedSummarizer = new SummarizeCode({
      name: 'SummarizeCode',
      llm: mockLLM,
      args: {
        code: sampleCode,
        language: 'TypeScript',
        options: {
          level: SummaryLevel.DETAILED
        }
      }
    });
    
    // Setup the ask method from BaseAction
    (briefSummarizer as any).ask = mockLLM.ask;
    (detailedSummarizer as any).ask = mockLLM.ask;
    
    // Execute the actions
    const briefResult = await briefSummarizer.run();
    const detailedResult = await detailedSummarizer.run();
    
    // Verify that the brief summary was formatted differently than the detailed one
    expect(briefResult.content.length).toBeLessThan(detailedResult.content.length);
    
    // Brief should contain simple component listing
    expect(briefResult.content).toContain('This code contains');
    
    // Detailed should include more information like dependencies
    expect(detailedResult.content).toMatch(/Location|Line Count|Complexity/);
  });
  
  it('should allow focusing on specific aspects of the summary', async () => {
    // Create SummarizeCode instance focusing only on components and improvements
    const focusedSummarizer = new SummarizeCode({
      name: 'SummarizeCode',
      llm: mockLLM,
      args: {
        code: sampleCode,
        language: 'TypeScript',
        options: {
          focus_on_components: true,
          focus_on_patterns: false,
          focus_on_improvements: true,
          focus_on_documentation: false
        }
      }
    });
    
    // Setup the ask method from BaseAction
    (focusedSummarizer as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await focusedSummarizer.run();
    
    // Should have components and improvements sections
    expect(result.content).toContain('Components');
    expect(result.content).toContain('Suggested Improvements');
    
    // Should not have design patterns and documentation sections
    expect(result.content).not.toContain('Design Patterns');
    expect(result.content).not.toMatch(/Documentation Analysis/);
  });
}); 