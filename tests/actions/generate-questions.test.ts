/**
 * Unit tests for GenerateQuestions action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateQuestions } from '../../src/actions/generate-questions';
import { MockLLM } from '../mocks/mock-llm';
import { UserMessage } from '../../src/types/message';
import { ContextImpl, ContextFactory, GlobalContext } from '../../src/context/context';
import { MemoryManagerImpl } from '../../src/memory/manager';

describe('GenerateQuestions', () => {
  // Mock LLM that returns predefined responses for different prompts
  let mockLLM: MockLLM;
  let generateQuestions: GenerateQuestions;
  let memory: MemoryManagerImpl;

  beforeEach(async () => {
    // Initialize context and memory
    GlobalContext.reset();
    memory = new MemoryManagerImpl();
    await memory.init();
    
    // Store memory in global context
    GlobalContext.getInstance().set('memory', memory);
    
    // Create the MockLLM as in the original test
    mockLLM = new MockLLM({
      responses: {
        default: 'Mock generation',
        'This is not valid JSON': 'This is not valid JSON',
        'Error': 'Mock response',
      }
    });

    // Create GenerateQuestions instance
    generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      llm: mockLLM,
    });
  });

  it('should initialize with correct properties', () => {
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: mockLLM
    });
    
    expect(generateQuestions).toBeInstanceOf(GenerateQuestions);
    expect(generateQuestions['name']).toBe('GenerateQuestions');
    expect(generateQuestions['llm']).toBe(mockLLM);
  });

  it('should initialize with question configuration when provided', () => {
    const questionConfig = {
      content: 'Sample content about AI ethics',
      difficulty: ['basic', 'intermediate'] as ('basic' | 'intermediate' | 'advanced')[],
      includeAnswers: false,
      questionTypes: ['factual', 'conceptual'],
      count: 5
    };

    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: mockLLM,
      questionConfig
    });
    
    expect(generateQuestions['questionConfig']).toEqual(questionConfig);
  });

  it('should fail when no content is provided', async () => {
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: mockLLM
    });
    
    // Execute the action without providing content
    const result = await generateQuestions.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No content provided');
  });
  
  it('should fail when no LLM provider is set', async () => {
    // Create GenerateQuestions instance without LLM
    const generateQuestionsNoLLM = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: null as any,
      questionConfig: {
        content: 'Sample content about AI ethics'
      }
    });
    
    // Execute the action
    const result = await generateQuestionsNoLLM.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('LLM provider is required');
  });

  it('should execute all nodes and return formatted questions', async () => {
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: mockLLM,
      questionConfig: {
        content: 'Sample content about AI ethics'
      }
    });
    
    // Spy on the executeNode method
    const executeNodeSpy = vi.spyOn(generateQuestions as any, 'executeNode');
    
    const result = await generateQuestions.run();
    
    // Verify that executeNode was called for each node
    expect(executeNodeSpy).toHaveBeenCalledTimes(7); // Number of nodes in QUESTION_NODES array
    
    // Verify that the result contains the expected content and format
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Generated Questions');
    expect(result.content).toContain('## Content Analysis');
    expect(result.content).toContain('## Factual Questions');
    expect(result.content).toContain('## Conceptual Questions');
    expect(result.content).toContain('## Application Questions');
    expect(result.content).toContain('## Critical Thinking Questions');
    expect(result.content).toContain('## Discussion Prompts');
    expect(result.content).toContain('## Question Organization');
    
    // Check for specific question content
    expect(result.content).toContain('What are the three main ethical concerns in AI');
    expect(result.content).toContain('How does the concept of fairness in AI systems');
  });

  it('should handle question config correctly', async () => {
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: mockLLM,
      questionConfig: {
        content: 'Sample content about AI ethics',
        includeAnswers: false
      }
    });
    
    const result = await generateQuestions.run();
    
    // Check that answers are not included when config specifies not to
    expect(result.content).not.toContain('*Answer:');
  });

  it('should extract content from message if provided', async () => {
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: mockLLM,
      args: {
        message: {
          content: 'Sample content about AI ethics from message',
          role: 'user'
        }
      }
    });
    
    const result = await generateQuestions.run();
    
    // Verify that the action completes successfully
    expect(result.status).toBe('completed');
    // Content analysis should be called with appropriate content
    expect(result.instructContent['Content Analysis']).toContain('artificial intelligence ethics');
  });

  it('should handle errors during node execution', async () => {
    // Create a mock LLM that will throw an error for a specific node
    const errorMockLLM = new MockLLM({
      responses: {},
      generateFn: async (prompt: string) => {
        if (prompt.includes('Critical Thinking Questions')) {
          throw new Error('Failed to generate critical thinking questions');
        }
        return 'Mock response';
      }
    });
    
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: errorMockLLM,
      questionConfig: {
        content: 'Sample content about AI ethics'
      }
    });
    
    const handleExceptionSpy = vi.spyOn(generateQuestions as any, 'handleException');
    
    const result = await generateQuestions.run();
    
    // Verify that handleException was called
    expect(handleExceptionSpy).toHaveBeenCalled();
    
    // The action should fail due to error
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Failed to generate questions');
  });

  it('should handle parsing errors gracefully', async () => {
    // Create a mock LLM that returns invalid JSON for a specific node
    const invalidJsonMockLLM = new MockLLM({
      responses: {
        'Content Analysis': 'The content discusses artificial intelligence ethics.',
        'Factual Questions': 'This is not valid JSON',
        'Conceptual Questions': 'Also not valid JSON',
      }
    });
    
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: invalidJsonMockLLM,
      questionConfig: {
        content: 'Sample content about AI ethics'
      }
    });
    
    // We'll mock formatQuestions to avoid errors in formatting invalid data
    vi.spyOn(generateQuestions as any, 'formatQuestions').mockReturnValue('Formatted questions');
    
    const result = await generateQuestions.run();
    
    // The action should still complete, even with parsing errors
    expect(result.status).toBe('completed');
    
    // Check that raw text is returned for nodes with parsing errors
    expect(result.instructContent['Factual Questions']).toBe('This is not valid JSON');
    expect(result.instructContent['Conceptual Questions']).toBe('Also not valid JSON');
  });
  
  it('should create appropriate node prompts', () => {
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: mockLLM,
      questionConfig: {
        content: 'Sample content',
        count: 8
      }
    });
    
    // Test a few different node types
    const factualPrompt = (generateQuestions as any).createNodePrompt({
      key: 'Factual Questions',
      instruction: 'Generate factual questions',
      example: []
    }, 'Test content');
    
    const conceptualPrompt = (generateQuestions as any).createNodePrompt({
      key: 'Conceptual Questions',
      instruction: 'Generate conceptual questions',
      example: []
    }, 'Test content');
    
    // Check that prompts include appropriate count distribution
    expect(factualPrompt).toContain('Generate approximately 2 factual questions');
    expect(conceptualPrompt).toContain('Generate approximately 2 conceptual questions');
    
    // Check that prompts include configuration
    expect(factualPrompt).toContain('Difficulty levels: basic, intermediate, advanced');
    expect(factualPrompt).toContain('Include answers: Yes');
  });
}); 