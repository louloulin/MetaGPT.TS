/**
 * Unit tests for Researcher role
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { Researcher } from '../../src/roles/researcher';
import { ResearchTopicType, ReliabilityRating } from '../../src/actions/research';
import { UserMessage } from '../../src/types/message';

// Mock LLM provider
const mockLLM = {
  chat: vi.fn(),
  getName: () => 'MockLLM',
  getModel: () => 'test-model',
  generate: vi.fn().mockImplementation(async (prompt: string) => {
    // Return a mock research result
    return JSON.stringify({
      query: 'Test query',
      topic_type: 'TECHNICAL',
      objective: 'Research comprehensive information about: Test query',
      sources: [{
        id: '1',
        title: 'Test Source',
        type: 'WEBSITE',
        reliability: 'HIGH',
        key_points: ['Test point 1', 'Test point 2']
      }],
      findings: [{
        id: '1',
        topic: 'Test Topic',
        description: 'Test finding',
        source_ids: ['1'],
        confidence: 0.8
      }],
      analysis: {
        patterns: ['Test pattern'],
        gaps: ['Test gap'],
        controversies: [],
        consensus: ['Test consensus'],
        emerging_trends: []
      },
      key_takeaways: ['Test takeaway'],
      summary: 'Test summary',
      confidence_score: 0.9,
      limitations: ['Test limitation'],
      future_research_directions: []
    });
  }),
  ask: vi.fn().mockImplementation(async (prompt: string) => {
    return 'Test response';
  })
};

describe('Researcher', () => {
  let researcher: Researcher;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create Researcher instance with mock LLM
    researcher = new Researcher({
      llm: mockLLM,
      defaultTopicType: ResearchTopicType.TECHNICAL,
      minReliability: ReliabilityRating.MEDIUM,
      maxSources: 5,
      react_mode: 'plan_and_act',
      max_react_loop: 3
    });
  });
  
  it('should create a Researcher instance', () => {
    expect(researcher).toBeInstanceOf(Researcher);
    expect(researcher.name).toBe('Researcher');
    expect(researcher.profile).toBe('Information Specialist');
    expect((researcher as any).defaultTopicType).toBe(ResearchTopicType.TECHNICAL);
    expect((researcher as any).minReliability).toBe(ReliabilityRating.MEDIUM);
    expect((researcher as any).maxSources).toBe(5);
  });
  
  it('should determine topic type correctly', async () => {
    // Access private method using type assertion
    const determineTopicType = (researcher as any).determineTopicType.bind(researcher);
    
    expect(determineTopicType('How to code in TypeScript')).toBe(ResearchTopicType.TECHNICAL);
    expect(determineTopicType('Market analysis of AI companies')).toBe(ResearchTopicType.BUSINESS);
    expect(determineTopicType('Latest science research on climate change')).toBe(ResearchTopicType.SCIENTIFIC);
    expect(determineTopicType('Philosophy of mind and consciousness')).toBe(ResearchTopicType.ACADEMIC);
    expect(determineTopicType('General information about cats')).toBe(ResearchTopicType.GENERAL);
  });
  
  it('should execute research and return results', async () => {
    // Create a proper UserMessage object
    const mockMessage = new UserMessage('Research TypeScript best practices');
    
    const result = await researcher.executeResearch(mockMessage);
    
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Test summary');
    
    // Verify that LLM was called with appropriate prompt
    expect(mockLLM.generate).toHaveBeenCalled();
  });
  
  it('should think and set todo action', async () => {
    // Create a proper UserMessage object
    const mockMessage = new UserMessage('Research TypeScript best practices');
    
    // Send message through the message subject
    (researcher as any).messageSubject.next(mockMessage);
    
    // Wait a bit for the message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Call think
    const result = await researcher.think();
    
    expect(result).toBe(true);
    
    // Check that a research action was set as todo
    const todo = researcher.context.todo;
    expect(todo).not.toBeNull();
    expect(todo?.name).toBe('Research');
    
    // Verify action arguments
    const args = todo?.args;
    expect(args?.query).toBe('Research TypeScript best practices');
    expect(args?.topic_type).toBe(ResearchTopicType.TECHNICAL);
  });
}); 