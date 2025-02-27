import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyzePrompt } from '../../src/actions/analyze-prompt';
import { UserMessage } from '../../src/types/message';

describe('AnalyzePrompt', () => {
  let mockLLM: any;
  let analyzePrompt: AnalyzePrompt;

  beforeEach(() => {
    // Create mock LLM
    mockLLM = {
      chat: vi.fn(),
      getName: () => 'MockLLM',
      getModel: () => 'test-model',
      generate: vi.fn(),
    };

    // Create AnalyzePrompt instance
    analyzePrompt = new AnalyzePrompt({
      name: 'AnalyzePrompt',
      llm: mockLLM,
    });
  });

  it('should create an AnalyzePrompt instance', () => {
    expect(analyzePrompt).toBeInstanceOf(AnalyzePrompt);
    expect(analyzePrompt.name).toBe('AnalyzePrompt');
  });

  it('should handle empty message list', async () => {
    const result = await analyzePrompt.run();
    expect(result.status).toBe('failed');
    expect(result.content).toBe('No messages available for analysis');
  });

  it('should analyze prompt successfully', async () => {
    // Mock successful LLM response
    const mockAnalysis = {
      core_request: 'Create a web application',
      explicit_requirements: ['Use React', 'Include authentication'],
      implicit_requirements: ['Need a database', 'Requires UI/UX design'],
      constraints: ['Must be responsive'],
      context_dependencies: ['Web development knowledge'],
      assumptions: ['Modern browser support'],
      clarification_questions: ['What type of authentication?'],
      complexity_assessment: 'COMPLEX',
      estimated_steps: 5
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockAnalysis));

    // Add a message to analyze
    analyzePrompt.context.memory.add(new UserMessage('Create a web application using React with authentication'));

    // Run analysis
    const result = await analyzePrompt.run();

    // Verify result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Prompt Analysis');
    expect(result.content).toContain('Create a web application');
    expect(result.content).toContain('Use React');
    expect(result.content).toContain('COMPLEX');
    expect(result.content).toContain('5');
  });

  it('should handle LLM response parsing error', async () => {
    // Mock LLM response with invalid JSON
    mockLLM.chat.mockResolvedValue('Invalid JSON response');

    // Add a message to analyze
    analyzePrompt.context.memory.add(new UserMessage('Test prompt'));

    // Run analysis
    const result = await analyzePrompt.run();

    // Verify fallback behavior
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Test prompt');
    expect(result.content).toContain('Analysis failed, treating as simple request');
    expect(result.content).toContain('SIMPLE');
  });

  it('should handle missing fields in LLM response', async () => {
    // Mock LLM response with missing fields
    const partialAnalysis = {
      core_request: 'Test request'
      // Other fields missing
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(partialAnalysis));

    // Add a message to analyze
    analyzePrompt.context.memory.add(new UserMessage('Test prompt'));

    // Run analysis
    const result = await analyzePrompt.run();

    // Verify default values are used
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Test request');
    expect(result.content).toContain('Requirements');
    expect(result.content).toContain('Constraints');
    expect(result.content).toContain('MODERATE');
    expect(result.content).toContain('1');
  });

  it('should format multi-line content correctly', async () => {
    // Mock analysis with multi-line content
    const mockAnalysis = {
      core_request: 'Multi-line\nrequest',
      explicit_requirements: ['Requirement 1\nPart 2', 'Requirement 2'],
      implicit_requirements: [],
      constraints: ['Constraint 1'],
      context_dependencies: [],
      assumptions: ['Assumption 1'],
      complexity_assessment: 'MODERATE',
      estimated_steps: 3
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockAnalysis));

    // Add a message to analyze
    analyzePrompt.context.memory.add(new UserMessage('Test multi-line prompt'));

    // Run analysis
    const result = await analyzePrompt.run();

    // Verify formatting
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Multi-line\nrequest');
    expect(result.content).toContain('- Requirement 1\nPart 2');
    expect(result.content).toContain('- Constraint 1');
    expect(result.content).toContain('MODERATE');
    expect(result.content).toContain('3');
  });
}); 