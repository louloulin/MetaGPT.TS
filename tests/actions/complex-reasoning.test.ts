/**
 * Unit tests for ComplexReasoning action
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComplexReasoning, ReasoningMethod } from '../../src/actions/complex-reasoning';
import type { ReasoningResult, ReasoningConfig } from '../../src/actions/complex-reasoning';
import { UserMessage } from '../../src/types/message';

describe('ComplexReasoning', () => {
  let mockLLM: any;
  let complexReasoning: ComplexReasoning;
  
  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
    
    // Create mock LLM
    mockLLM = {
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
    
    // Create ComplexReasoning instance
    complexReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
    });
    
    // Setup the ask method from BaseAction
    (complexReasoning as any).ask = mockLLM.ask;
  });

  afterEach(() => {
    // Clear mock function calls after each test
    vi.clearAllMocks();
  });
  
  it('should create a ComplexReasoning instance', () => {
    expect(complexReasoning).toBeInstanceOf(ComplexReasoning);
    expect(complexReasoning.name).toBe('ComplexReasoning');
  });
  
  it('should handle empty message list', async () => {
    const result = await complexReasoning.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No problem statement provided for reasoning');
  });
  
  it('should perform complex reasoning successfully', async () => {
    // Set up test data
    (complexReasoning as any).setArg('problem', 'How can we optimize system performance?');
    
    const result = await complexReasoning.run();
    
    expect(result.status).toBe('completed');
    expect(result.content).toBeTruthy();
  });
  
  it('should handle LLM response parsing error', async () => {
    // Set up test data with invalid JSON response
    (complexReasoning as any).setArg('problem', 'invalid json');
    
    const result = await complexReasoning.run();
    
    expect(result.status).toBe('completed');
    expect(result.content).toBeTruthy();
  });
  
  it('should handle missing fields in LLM response', async () => {
    // Set up test data
    (complexReasoning as any).setArg('problem', 'test problem');
    
    const result = await complexReasoning.run();
    
    expect(result.status).toBe('completed');
    expect(result.content).toBeTruthy();
  });
  
  it('should handle different reasoning methods', async () => {
    // Set up test data
    (complexReasoning as any).setArg('problem', 'test problem');
    (complexReasoning as any).setArg('reasoning_methods', [ReasoningMethod.DEDUCTIVE]);
    
    const result = await complexReasoning.run();
    
    expect(result.status).toBe('completed');
    expect(result.content).toBeTruthy();
  });
  
  it('should respect confidence thresholds', async () => {
    // Create a new instance with high confidence threshold
    const highConfidenceReasoning = new ComplexReasoning({
      name: 'HighConfidenceReasoning',
      llm: mockLLM,
      description: 'Test instance with high confidence threshold',
      args: {
        problem: 'test problem',
        required_confidence: 0.99
      }
    });
    
    const result = await highConfidenceReasoning.run();
    
    expect(result.status).toBe('completed');
    expect(result.content).toBeTruthy();
  });
}); 