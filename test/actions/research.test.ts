import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Research, ResearchTopicType } from '../../src/actions/research';
import type { ActionConfig } from '../../src/types/action';

describe('Research', () => {
  let research: Research;
  let mockLLM: { generate: any };

  beforeEach(() => {
    mockLLM = {
      generate: vi.fn(),
    };
    research = new Research({
      name: 'Research',
      llm: mockLLM as any,
      args: {
        query: 'test query',
        topic_type: ResearchTopicType.TECHNICAL
      }
    } as ActionConfig);
  });

  it('performs research successfully', async () => {
    const mockResponse = JSON.stringify({
      query: 'test query',
      topic_type: ResearchTopicType.TECHNICAL,
      sources: ['source1', 'source2'],
      findings: ['finding1', 'finding2'],
      analysis: {
        patterns: ['pattern1'],
        gaps: ['gap1'],
        controversies: ['controversy1'],
        consensus: ['consensus1'],
        emerging_trends: ['trend1']
      },
      key_takeaways: ['takeaway1', 'takeaway2'],
      summary: 'summary',
      limitations: ['limitation1'],
      future_research_directions: ['direction1'],
      confidence_score: 0.8
    });

    vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

    const result = await research.run();
    expect(result.content).toEqual(mockResponse);
  });

  it('throws error when no query is provided', async () => {
    research = new Research({
      name: 'Research',
      llm: mockLLM as any
    } as ActionConfig);

    await expect(research.run()).rejects.toThrow('No research query provided');
  });

  it('throws error when LLM returns invalid JSON', async () => {
    vi.mocked(mockLLM.generate).mockResolvedValueOnce('invalid json');
    await expect(research.run()).rejects.toThrow();
  });

  it('throws error when LLM response is missing required fields', async () => {
    const invalidResponse = JSON.stringify({
      query: 'test query',
      // Missing other required fields
    });

    vi.mocked(mockLLM.generate).mockResolvedValueOnce(invalidResponse);
    await expect(research.run()).rejects.toThrow('Missing required fields');
  });

  it('throws error when LLM fails', async () => {
    vi.mocked(mockLLM.generate).mockRejectedValueOnce(new Error('LLM failed'));
    await expect(research.run()).rejects.toThrow('LLM failed');
  });

  it('sets default topic type when not provided by LLM', async () => {
    const mockResponse = JSON.stringify({
      query: 'test query',
      sources: ['source1'],
      findings: ['finding1'],
      analysis: {
        patterns: ['pattern1'],
        gaps: ['gap1'],
        controversies: ['controversy1'],
        consensus: ['consensus1'],
        emerging_trends: ['trend1']
      },
      key_takeaways: ['takeaway1'],
      summary: 'summary',
      limitations: ['limitation1'],
      future_research_directions: ['direction1'],
      confidence_score: 0.8
    });

    vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

    const result = await research.run();
    const content = JSON.parse(result.content);
    expect(content.topic_type).toBe(ResearchTopicType.GENERAL);
  });

  it('sets default confidence score when invalid', async () => {
    const mockResponse = JSON.stringify({
      query: 'test query',
      topic_type: ResearchTopicType.TECHNICAL,
      sources: ['source1'],
      findings: ['finding1'],
      analysis: {
        patterns: ['pattern1'],
        gaps: ['gap1'],
        controversies: ['controversy1'],
        consensus: ['consensus1'],
        emerging_trends: ['trend1']
      },
      key_takeaways: ['takeaway1'],
      summary: 'summary',
      limitations: ['limitation1'],
      future_research_directions: ['direction1'],
      confidence_score: 2 // Invalid score
    });

    vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

    const result = await research.run();
    const content = JSON.parse(result.content);
    expect(content.confidence_score).toBe(0.5);
  });
}); 