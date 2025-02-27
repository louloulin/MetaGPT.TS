/**
 * Unit tests for ComplexReasoning action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComplexReasoning, ReasoningMethod } from '../../src/actions/complex-reasoning';
import type { ReasoningResult, ReasoningConfig } from '../../src/actions/complex-reasoning';
import { UserMessage } from '../../src/types/message';

// Mock LLM provider
const mockLLM = {
  chat: vi.fn(),
  getName: () => 'MockLLM',
  getModel: () => 'test-model',
  generate: vi.fn(),
  ask: vi.fn().mockImplementation(async (prompt: string) => {
    // Mock response for reasoning
    if (prompt.includes('software design pattern')) {
      return JSON.stringify({
        problem_statement: "Determine the most appropriate design pattern for a notification system that needs to send updates to multiple subscribers in different formats.",
        problem_analysis: "This problem involves a one-to-many dependency where changes in one object need to be communicated to multiple dependent objects. The subscribers may have different requirements for how they receive and process notifications.",
        assumptions: [
          "The notification system needs to be extensible for new subscriber types",
          "Subscribers can be added or removed dynamically",
          "Different subscribers may require different notification formats"
        ],
        sub_problems: [
          {
            id: "notification-mechanism",
            description: "How to efficiently notify multiple subscribers when events occur",
            prerequisites: [],
            solution: "Implement a publisher-subscriber relationship with a registration mechanism",
            reasoning_steps: [
              {
                step_number: 1,
                description: "Analyze communication requirements",
                method: "DEDUCTIVE",
                input: "Need to send notifications to multiple subscribers",
                output: "One-to-many relationship identified",
                confidence: 0.95,
                justification: "The problem clearly describes a one-to-many dependency scenario"
              }
            ]
          },
          {
            id: "format-handling",
            description: "How to handle different notification formats for different subscribers",
            prerequisites: ["notification-mechanism"],
            solution: "Allow subscribers to implement their own update methods",
            reasoning_steps: [
              {
                step_number: 1,
                description: "Assess format requirements",
                method: "ANALOGICAL",
                input: "Different subscribers need different formats",
                output: "Polymorphic approach needed",
                confidence: 0.9,
                justification: "Similar problems are typically solved using polymorphism"
              }
            ]
          }
        ],
        reasoning_path: [
          {
            step_number: 1,
            description: "Identify the core challenge",
            method: "DEDUCTIVE",
            input: "Notification system with multiple subscribers in different formats",
            output: "This is a dependency management and communication problem",
            confidence: 0.95,
            justification: "The problem revolves around managing dependencies and communication between objects"
          },
          {
            step_number: 2,
            description: "Evaluate known design patterns",
            method: "ANALOGICAL",
            input: "Dependency management and communication problem",
            output: "Observer, Publish-Subscribe, and Mediator patterns are candidates",
            confidence: 0.9,
            justification: "These patterns are commonly used to solve communication problems between objects"
          },
          {
            step_number: 3,
            description: "Compare pattern characteristics with requirements",
            method: "BAYESIAN",
            input: "Observer, Publish-Subscribe, and Mediator patterns",
            output: "Observer pattern has the highest match",
            confidence: 0.85,
            justification: "Based on the specific requirements of notification and format handling"
          }
        ],
        conclusion: "The Observer design pattern is the most appropriate solution for this notification system.",
        recommended_solution: "Implement the Observer design pattern with a Subject (Publisher) interface and Concrete Subject, along with an Observer interface and Concrete Observer implementations for each subscriber type. The Subject maintains a list of Observers and notifies them of state changes. Each Observer implementation can handle the notification in its own format.",
        alternative_solutions: [
          {
            description: "Mediator Pattern",
            pros: [
              "Centralizes communication logic",
              "Reduces coupling between components"
            ],
            cons: [
              "Adds an extra layer of complexity",
              "May become a bottleneck",
              "Less direct for simple notification scenarios"
            ],
            confidence: 0.7
          },
          {
            description: "Event Bus/Publish-Subscribe Pattern",
            pros: [
              "More decoupled than Observer",
              "Scales well for complex event systems",
              "Supports many-to-many relationships"
            ],
            cons: [
              "More complex to implement",
              "Potentially harder to debug",
              "May be overkill for this specific scenario"
            ],
            confidence: 0.6
          }
        ],
        confidence_score: 0.85,
        limitations: [
          "The solution assumes a relatively simple notification system",
          "May need adaptation for distributed systems"
        ],
        additional_information_needed: [
          "Performance requirements for the system",
          "Expected number of subscribers"
        ]
      });
    } 
    // Mock response for invalid JSON
    else if (prompt.includes('invalid json')) {
      return 'This is not valid JSON';
    }
    // Mock response for a simple math problem
    else if (prompt.includes('area of circle')) {
      return JSON.stringify({
        problem_statement: "Calculate the area of a circle with radius 5 units.",
        problem_analysis: "To find the area of a circle, we need to use the formula: Area = π × radius².",
        assumptions: [
          "The radius is exactly 5 units",
          "We're working in a flat Euclidean space",
          "π is approximately 3.14159"
        ],
        sub_problems: [
          {
            id: "area-calculation",
            description: "Calculate the area using the formula",
            prerequisites: [],
            solution: "Area = π × 5² = π × 25 = 78.54 square units"
          }
        ],
        reasoning_path: [
          {
            step_number: 1,
            description: "Identify the formula",
            method: "DEDUCTIVE",
            input: "Area of a circle calculation",
            output: "Area = π × radius²",
            confidence: 1.0,
            justification: "This is the standard formula for circle area in Euclidean geometry"
          },
          {
            step_number: 2,
            description: "Substitute values",
            method: "DEDUCTIVE",
            input: "Area = π × radius², radius = 5",
            output: "Area = π × 5²",
            confidence: 1.0,
            justification: "Direct substitution of given values"
          },
          {
            step_number: 3,
            description: "Calculate the result",
            method: "DEDUCTIVE",
            input: "π × 5²",
            output: "78.54 square units",
            confidence: 0.99,
            justification: "Mathematical calculation with π ≈ 3.14159"
          }
        ],
        conclusion: "The area of a circle with radius 5 units is 78.54 square units.",
        recommended_solution: "Area = π × r² = 3.14159 × 5² = 3.14159 × 25 = 78.54 square units",
        alternative_solutions: [],
        confidence_score: 0.99,
        limitations: [
          "Result is rounded to 2 decimal places",
          "Uses approximation of π"
        ]
      });
    }
    // Default fallback response
    else {
      return JSON.stringify({
        problem_statement: "Analysis not possible for provided problem",
        problem_analysis: "The problem could not be fully analyzed",
        assumptions: ["Limited analysis was performed"],
        sub_problems: [
          {
            id: "main",
            description: "Main problem",
            prerequisites: [],
            solution: "No specific solution could be generated"
          }
        ],
        reasoning_path: [
          {
            step_number: 1,
            description: "Initial assessment",
            method: "DEDUCTIVE",
            input: "Provided problem statement",
            output: "Problem categorization incomplete",
            confidence: 0.3,
            justification: "Insufficient problem details"
          }
        ],
        conclusion: "Could not reach a conclusive solution for the given problem.",
        recommended_solution: "Please provide more details about the problem for better analysis",
        alternative_solutions: [],
        confidence_score: 0.2,
        limitations: [
          "Insufficient problem context",
          "Problem may be too vague or complex"
        ],
        additional_information_needed: [
          "Clearer problem statement",
          "Specific constraints and requirements"
        ]
      });
    }
  })
};

describe('ComplexReasoning', () => {
  let mockLLM: any;
  let complexReasoning: ComplexReasoning;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create mock LLM
    mockLLM = {
      chat: vi.fn(),
      getName: () => 'MockLLM',
      getModel: () => 'test-model',
      generate: vi.fn(),
    };
    
    // Create ComplexReasoning instance
    complexReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
    });
    
    // Setup the ask method from BaseAction
    (complexReasoning as any).ask = mockLLM.ask;
  });
  
  it('should create a ComplexReasoning instance', () => {
    expect(complexReasoning).toBeInstanceOf(ComplexReasoning);
    expect(complexReasoning.name).toBe('ComplexReasoning');
  });
  
  it('should handle empty message list', async () => {
    const result = await complexReasoning.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages available');
  });
  
  it('should perform complex reasoning successfully', async () => {
    const mockResult: ReasoningResult = {
      problem_statement: "Optimize system performance under high load",
      problem_analysis: "System experiencing slowdown during peak usage hours",
      assumptions: [
        "Current infrastructure can be modified",
        "Budget available for optimization"
      ],
      sub_problems: [
        {
          id: "SP1",
          description: "Database query optimization",
          prerequisites: [],
          solution: "Implement query caching",
          reasoning_steps: [
            {
              step_number: 1,
              description: "Analyze query patterns",
              method: ReasoningMethod.DEDUCTIVE,
              input: "Query logs",
              output: "Frequently executed queries identified",
              confidence: 0.9,
              justification: "Log analysis shows clear patterns"
            }
          ]
        }
      ],
      reasoning_path: [
        {
          step_number: 1,
          description: "Problem decomposition",
          method: ReasoningMethod.ANALOGICAL,
          input: "System performance metrics",
          output: "Key bottlenecks identified",
          confidence: 0.85,
          justification: "Based on performance data"
        }
      ],
      conclusion: "Implement caching and load balancing",
      recommended_solution: "Multi-layer caching strategy",
      alternative_solutions: [
        {
          description: "Hardware upgrade",
          pros: ["Immediate improvement", "Simple to implement"],
          cons: ["Expensive", "Temporary solution"],
          confidence: 0.7
        }
      ],
      confidence_score: 0.85,
      limitations: ["Cost constraints", "Implementation complexity"],
      additional_information_needed: ["Detailed performance metrics"]
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockResult));

    complexReasoning.context.memory.add(new UserMessage('How can we optimize system performance?'));

    const result = await complexReasoning.run();

    expect(result.status).toBe('completed');
    expect(result.content).toContain('Problem Statement');
    expect(result.content).toContain('Analysis');
    expect(result.content).toContain('Sub-Problems');
    expect(result.content).toContain('Reasoning Path');
    expect(result.content).toContain('Conclusion');
    expect(result.content).toContain('Alternative Solutions');
  });
  
  it('should handle LLM response parsing error', async () => {
    // Mock LLM response with invalid JSON
    mockLLM.chat.mockResolvedValue('Invalid JSON response');

    // Add a message to process
    complexReasoning.context.memory.add(new UserMessage('Analyze this problem'));

    // Run reasoning
    const result = await complexReasoning.run();

    // Verify fallback behavior
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Reasoning Analysis');
    expect(result.content).toContain('Unable to generate detailed analysis');
    expect(result.content).toContain('Basic problem information');
  });
  
  it('should handle missing fields in LLM response', async () => {
    // Mock LLM response with missing fields
    const partialResult = {
      problem_statement: 'Test problem',
      problem_analysis: 'Basic analysis'
      // Other fields missing
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(partialResult));

    // Add a message to process
    complexReasoning.context.memory.add(new UserMessage('Analyze this problem'));

    // Run reasoning
    const result = await complexReasoning.run();

    // Verify default values are used
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Test problem');
    expect(result.content).toContain('Basic analysis');
    expect(result.content).toContain('No sub-problems identified');
  });
  
  it('should handle different reasoning methods', async () => {
    const testCases = [
      {
        method: ReasoningMethod.DEDUCTIVE,
        description: 'Logical deduction from general principles'
      },
      {
        method: ReasoningMethod.INDUCTIVE,
        description: 'Pattern recognition from specific cases'
      },
      {
        method: ReasoningMethod.ABDUCTIVE,
        description: 'Best explanation for observations'
      },
      {
        method: ReasoningMethod.ANALOGICAL,
        description: 'Comparison with similar situations'
      }
    ];

    for (const testCase of testCases) {
      // Mock reasoning result for each method
      const mockResult: ReasoningResult = {
        problem_statement: `Test problem using ${testCase.method}`,
        problem_analysis: testCase.description,
        assumptions: ['Test assumption'],
        sub_problems: [],
        reasoning_path: [
          {
            step_number: 1,
            description: `Apply ${testCase.method}`,
            method: testCase.method,
            input: 'Test input',
            output: 'Test output',
            confidence: 0.8,
            justification: 'Test justification'
          }
        ],
        conclusion: 'Test conclusion',
        recommended_solution: 'Test solution',
        alternative_solutions: [],
        confidence_score: 0.8,
        limitations: ['Test limitation']
      };

      mockLLM.chat.mockResolvedValue(JSON.stringify(mockResult));

      // Add a message to process
      complexReasoning.context.memory.add(new UserMessage(`Analyze using ${testCase.method}`));

      // Run reasoning
      const result = await complexReasoning.run();

      // Verify method-specific handling
      expect(result.status).toBe('completed');
      expect(result.content).toContain(testCase.method);
      expect(result.content).toContain(testCase.description);
    }
  });
  
  it('should respect confidence thresholds', async () => {
    // Create instance with high confidence requirement
    const highConfidenceReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
      args: {
        required_confidence: 0.9
      }
    });

    // Mock result with low confidence
    const mockResult: ReasoningResult = {
      problem_statement: 'Test problem',
      problem_analysis: 'Test analysis',
      assumptions: ['Test assumption'],
      sub_problems: [],
      reasoning_path: [
        {
          step_number: 1,
          description: 'Test step',
          method: ReasoningMethod.DEDUCTIVE,
          input: 'Test input',
          output: 'Test output',
          confidence: 0.7,
          justification: 'Test justification'
        }
      ],
      conclusion: 'Test conclusion',
      recommended_solution: 'Test solution',
      alternative_solutions: [],
      confidence_score: 0.7,
      limitations: ['Confidence below threshold']
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockResult));

    // Add a message to process
    highConfidenceReasoning.context.memory.add(new UserMessage('Analyze this problem'));

    // Run reasoning
    const result = await highConfidenceReasoning.run();

    // Verify confidence handling
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Warning: Confidence below required threshold');
    expect(result.content).toContain('Consider gathering more information');
  });
}); 