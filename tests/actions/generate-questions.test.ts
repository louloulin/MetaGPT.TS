/**
 * Unit tests for GenerateQuestions action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateQuestions } from '../../src/actions/generate-questions';
import { createLLMProvider } from '../mocks/llm-provider';
import { UserMessage } from '../../src/types/message';
import { ContextImpl, ContextFactory, GlobalContext } from '../../src/context/context';
import { MemoryManagerImpl } from '../../src/memory/manager';

describe('GenerateQuestions', () => {
  // LLM provider for tests
  let llmProvider: any;
  let generateQuestions: GenerateQuestions;
  let memory: MemoryManagerImpl;

  beforeEach(async () => {
    // Initialize context and memory
    GlobalContext.reset();
    memory = new MemoryManagerImpl();
    await memory.init();
    
    // Store memory in global context
    GlobalContext.getInstance().set('memory', memory);
    
    // Create an LLM provider with custom system prompt
    const systemPrompt = "You are a question generation expert. Generate appropriate questions based on the provided content.";
    llmProvider = createLLMProvider(systemPrompt);
    
    // Mock the chat method to return predefined responses
    llmProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('This is not valid JSON')) {
        return 'This is not valid JSON';
      } else if (prompt.includes('Error')) {
        return 'Mock response';
      } else if (prompt.includes('Content Analysis')) {
        return 'The content focuses on artificial intelligence ethics, discussing principles like transparency, fairness, and privacy.';
      } else if (prompt.includes('Factual Questions')) {
        return JSON.stringify([
          {
            question: "What are the three main ethical concerns in AI as mentioned in the content?",
            answer: "The three main ethical concerns are fairness, transparency, and privacy."
          },
          {
            question: "Who developed the ethical framework for AI discussed in the content?",
            answer: "Various organizations including IEEE and the EU Commission."
          }
        ]);
      } else if (prompt.includes('Conceptual Questions')) {
        return JSON.stringify([
          {
            question: "How does the concept of fairness in AI systems relate to bias in training data?",
            answer: "Fairness in AI systems can be compromised when training data contains historical biases, leading to biased outputs."
          }
        ]);
      } else if (prompt.includes('Application Questions')) {
        return JSON.stringify([
          {
            question: "How might a company apply the principle of transparency in their AI product?",
            answer: "A company could provide clear documentation about how their AI makes decisions and what data was used to train it."
          }
        ]);
      } else if (prompt.includes('Critical Thinking Questions')) {
        return JSON.stringify([
          {
            question: "What are the potential conflicts between maximizing AI performance and ensuring ethical compliance?",
            answer: "There may be tradeoffs between model accuracy and fairness, especially when correcting for biases might reduce overall accuracy."
          }
        ]);
      } else if (prompt.includes('Discussion Prompts')) {
        return JSON.stringify([
          {
            prompt: "Discuss the balance between innovation and regulation in AI development.",
            talking_points: ["Innovation pace", "Regulatory frameworks", "Public safety"]
          }
        ]);
      } else if (prompt.includes('Question Organization')) {
        return JSON.stringify({
          basic: ["What are ethics in AI?", "What is bias in AI?"],
          intermediate: ["How does transparency affect AI adoption?"],
          advanced: ["Analyze the conflicts between different ethical principles in AI systems."]
        });
      }
      
      return 'Mock generation';
    });

    // Create GenerateQuestions instance
    generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      llm: llmProvider,
    });
  });

  it('should initialize with correct properties', () => {
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: llmProvider
    });
    
    expect(generateQuestions).toBeInstanceOf(GenerateQuestions);
    expect(generateQuestions['name']).toBe('GenerateQuestions');
    expect(generateQuestions['llm']).toBe(llmProvider);
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
      llm: llmProvider,
      questionConfig
    });
    
    expect(generateQuestions['questionConfig']).toEqual(questionConfig);
  });

  it('should fail when no content is provided', async () => {
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: llmProvider
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
      llm: llmProvider,
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
      llm: llmProvider,
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
      llm: llmProvider,
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
    // Create an LLM provider that will throw an error for a specific node
    const errorLLMProvider = createLLMProvider("Error simulation");
    errorLLMProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('Critical Thinking Questions')) {
        throw new Error('Failed to generate critical thinking questions');
      }
      return 'Mock response';
    });
    
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: errorLLMProvider,
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
    // Create an LLM provider that returns invalid JSON for specific nodes
    const invalidJsonLLMProvider = createLLMProvider("Invalid JSON simulation");
    invalidJsonLLMProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('Content Analysis')) {
        return 'The content discusses artificial intelligence ethics.';
      } else if (prompt.includes('Factual Questions')) {
        return 'This is not valid JSON';
      } else if (prompt.includes('Conceptual Questions')) {
        return 'Also not valid JSON';
      }
      return 'Mock response';
    });
    
    const generateQuestions = new GenerateQuestions({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      llm: invalidJsonLLMProvider,
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
      llm: llmProvider,
      questionConfig: {
        content: 'Sample content about AI ethics'
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