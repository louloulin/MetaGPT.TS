/**
 * Unit tests for ComplexReasoning action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComplexReasoning, ReasoningMethod } from '../../src/actions/complex-reasoning';
import type { ReasoningResult, ReasoningConfig } from '../../src/actions/complex-reasoning';

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
  let complexReasoning: ComplexReasoning;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create ComplexReasoning instance with mock LLM
    complexReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
    });
    
    // Setup the ask method from BaseAction
    (complexReasoning as any).ask = mockLLM.ask;
  });
  
  it('should create a ComplexReasoning instance', () => {
    expect(complexReasoning).toBeInstanceOf(ComplexReasoning);
  });
  
  it('should fail when no problem is provided', async () => {
    // Run the action without providing a problem
    const result = await complexReasoning.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No problem statement provided');
  });
  
  it('should analyze a design pattern problem and provide structured reasoning', async () => {
    // Create ComplexReasoning instance with a design pattern problem
    const designProblemReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
      args: {
        problem: 'What is the most appropriate software design pattern for a notification system that needs to send updates to multiple subscribers in different formats?',
        context: 'Building a modular and extensible system'
      }
    });
    
    // Setup the ask method
    (designProblemReasoning as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await designProblemReasoning.run();
    
    // Verify that reasoning was performed correctly
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Observer design pattern');
    expect(result.content).toContain('Problem Decomposition');
    expect(result.content).toContain('Alternative Solutions');
    
    // Verify that the instructContent contains the ReasoningResult
    const reasoningResult = result.instructContent as ReasoningResult;
    expect(reasoningResult.problem_statement).toContain('design pattern for a notification system');
    expect(reasoningResult.conclusion).toContain('Observer design pattern');
    expect(reasoningResult.confidence_score).toBeGreaterThan(0.8);
    expect(reasoningResult.sub_problems.length).toBe(2);
    expect(reasoningResult.reasoning_path.length).toBe(3);
    expect(reasoningResult.alternative_solutions.length).toBe(2);
  });
  
  it('should handle mathematical problems effectively', async () => {
    // Create ComplexReasoning instance with a math problem
    const mathProblemReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
      args: {
        problem: 'Calculate the area of circle with radius 5 units',
        domain_specific_knowledge: 'Mathematical formulas for geometric shapes'
      }
    });
    
    // Setup the ask method
    (mathProblemReasoning as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await mathProblemReasoning.run();
    
    // Verify the reasoning result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('78.54 square units');
    
    // Check specific reasoning elements
    const reasoningResult = result.instructContent as ReasoningResult;
    expect(reasoningResult.problem_statement).toContain('Calculate the area of a circle');
    expect(reasoningResult.reasoning_path.length).toBe(3);
    expect(reasoningResult.confidence_score).toBeGreaterThan(0.95);
  });
  
  it('should respect reasoning method constraints when specified', async () => {
    // Spy on the constructReasoningPrompt method
    const promptSpy = vi.spyOn(ComplexReasoning.prototype as any, 'constructReasoningPrompt');
    
    // Create ComplexReasoning instance with specific reasoning methods
    const constrainedReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
      args: {
        problem: 'What is the best approach for optimizing a database query?',
        reasoning_methods: [ReasoningMethod.DEDUCTIVE, ReasoningMethod.CAUSAL]
      }
    });
    
    // Setup the ask method
    (constrainedReasoning as any).ask = mockLLM.ask;
    
    // Execute the action
    await constrainedReasoning.run();
    
    // Check that only the specified reasoning methods were included in the prompt
    expect(promptSpy).toHaveBeenCalled();
    const promptCall = promptSpy.mock.calls[0][0] as ReasoningConfig;
    expect(promptCall.reasoning_methods).toHaveLength(2);
    expect(promptCall.reasoning_methods).toContain(ReasoningMethod.DEDUCTIVE);
    expect(promptCall.reasoning_methods).toContain(ReasoningMethod.CAUSAL);
    expect(promptCall.reasoning_methods).not.toContain(ReasoningMethod.ANALOGICAL);
  });
  
  it('should handle LLM response parsing errors gracefully', async () => {
    // Create ComplexReasoning instance with input that will trigger invalid JSON
    const invalidJsonReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
      args: {
        problem: 'This will trigger invalid json',
      }
    });
    
    // Setup the ask method
    (invalidJsonReasoning as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await invalidJsonReasoning.run();
    
    // Verify that a fallback result was created
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Reasoning process encountered an error');
    
    // Verify the fallback reasoning result structure
    const fallbackResult = result.instructContent as ReasoningResult;
    expect(fallbackResult.problem_statement).toBe('This will trigger invalid json');
    expect(fallbackResult.conclusion).toContain('error');
    expect(fallbackResult.confidence_score).toBe(0);
    expect(fallbackResult.limitations.length).toBeGreaterThan(0);
  });
  
  it('should enforce confidence thresholds when specified', async () => {
    // Mock implementation to return a result with medium confidence
    mockLLM.ask.mockImplementationOnce(async () => {
      return JSON.stringify({
        problem_statement: "Some test problem",
        problem_analysis: "Basic analysis",
        assumptions: ["Test assumption"],
        sub_problems: [{
          id: "sub1",
          description: "Sub-problem 1",
          prerequisites: [],
          solution: "Basic solution"
        }],
        reasoning_path: [{
          step_number: 1,
          description: "Step 1",
          method: "DEDUCTIVE",
          input: "Input data",
          output: "Output data",
          confidence: 0.7,
          justification: "Basic justification"
        }],
        conclusion: "Test conclusion",
        recommended_solution: "Test solution",
        alternative_solutions: [],
        confidence_score: 0.65, // Below the threshold
        limitations: ["Test limitation"]
      });
    });
    
    // Create ComplexReasoning instance with high confidence requirement
    const highConfidenceReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
      args: {
        problem: 'Test confidence threshold problem',
        required_confidence: 0.8 // Set high confidence threshold
      }
    });
    
    // Setup the ask method
    (highConfidenceReasoning as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await highConfidenceReasoning.run();
    
    // Verify the result
    const reasoningResult = result.instructContent as ReasoningResult;
    expect(reasoningResult.confidence_score).toBe(0.65);
    expect(reasoningResult.limitations).toContain(expect.stringContaining('confidence') && expect.stringContaining('below the required threshold'));
  });
  
  it('should customize output based on domain knowledge', async () => {
    // Create a spy for the constructReasoningPrompt method
    const promptSpy = vi.spyOn(ComplexReasoning.prototype as any, 'constructReasoningPrompt');
    
    // Domain-specific knowledge
    const domainKnowledge = `
    Machine Learning Principles:
    1. Supervised Learning: Models learn from labeled data
    2. Unsupervised Learning: Models find patterns in unlabeled data
    3. Reinforcement Learning: Models learn through trial and error
    `;
    
    // Create ComplexReasoning instance with domain knowledge
    const domainSpecificReasoning = new ComplexReasoning({
      name: 'ComplexReasoning',
      llm: mockLLM,
      args: {
        problem: 'What machine learning approach should I use for sentiment analysis?',
        domain_specific_knowledge: domainKnowledge
      }
    });
    
    // Setup the ask method
    (domainSpecificReasoning as any).ask = mockLLM.ask;
    
    // Execute the action
    await domainSpecificReasoning.run();
    
    // Check that domain knowledge was included in the prompt
    expect(promptSpy).toHaveBeenCalled();
    const promptCall = promptSpy.mock.calls[0][0] as ReasoningConfig;
    expect(promptCall.domain_specific_knowledge).toBe(domainKnowledge);
  });
}); 