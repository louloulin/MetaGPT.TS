/**
 * Unit tests for Research action
 */

import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import { Research, type ResearchResult, ReliabilityRating, ResearchTopicType, SourceType } from '../../src/actions/research';
import type { ActionOutput } from '../../src/types/action';
import { createLLMProvider } from '../mocks/llm-provider';
import { ArrayMemory } from '../../src/types/memory';

describe('Research', () => {
  let llmProvider: any;

  beforeEach(() => {
    // Create an LLM provider with custom system prompt
    const systemPrompt = "You are a research expert. Provide detailed, structured research results.";
    llmProvider = createLLMProvider(systemPrompt);
    
    // Mock the chat method to return predefined responses
    llmProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('Recent advances in solar energy technology')) {
        return JSON.stringify({
          query: "Recent advances in solar energy technology",
          topic_type: ResearchTopicType.TECHNICAL,
          objective: "Analyze recent developments and trends in solar energy technology",
          sources: [
            {
              id: "source-1",
              title: "Solar Cell Efficiency Tables",
              url: "https://example.com/solar-efficiency",
              author: "Research Group",
              publicationDate: "2023",
              type: SourceType.ACADEMIC_PAPER,
              reliability: ReliabilityRating.HIGH,
              key_points: [
                "New perovskite solar cells achieve 25% efficiency",
                "Tandem cells show promise for higher efficiency",
                "Manufacturing costs reduced by 80% since 2010"
              ]
            }
          ],
          findings: [
            {
              id: "finding-1",
              topic: "Efficiency Improvements",
              description: "Solar cell efficiency has increased significantly",
              source_ids: ["source-1"],
              confidence: 0.9
            }
          ],
          analysis: {
            patterns: [
              "Consistent improvement in efficiency",
              "Cost reduction trend",
              "Focus on new materials"
            ],
            gaps: [
              "Limited long-term durability data",
              "Incomplete recycling solutions"
            ],
            controversies: [
              "Environmental impact of production",
              "Grid integration challenges"
            ],
            consensus: [
              "Solar is becoming cost-competitive",
              "Technology is mature enough for widespread adoption"
            ],
            emerging_trends: [
              "Integration of AI for optimized production and management",
              "Agrivoltaics combining agriculture and solar production",
              "Decentralized microgrids powered by solar energy"
            ]
          },
          key_takeaways: [
            "Solar technology efficiency continues to improve with new materials and designs",
            "Costs have decreased dramatically, making solar economically competitive",
            "Novel deployment methods are expanding solar's potential applications",
            "Integration with storage technologies is addressing intermittency issues"
          ],
          summary: "Recent advances in solar energy technology have significantly improved efficiency and reduced costs, making solar power increasingly competitive with conventional energy sources. Innovations in materials science, particularly perovskite and tandem solar cells, have pushed efficiency beyond 25%, while manufacturing improvements and economies of scale have reduced costs by approximately 80% since 2010. Novel deployment methods, including bifacial panels, building-integrated photovoltaics, and floating solar farms, are expanding the potential applications of solar energy. The integration of solar with energy storage systems is addressing intermittency challenges, while emerging trends such as AI optimization, agrivoltaics, and decentralized microgrids point to continued innovation in the field. While some challenges remain, including grid integration on a large scale and end-of-life management, there is consensus that solar energy technology has reached a tipping point of economic viability and technological maturity.",
          confidence_score: 0.85,
          limitations: [
            "Research primarily focuses on technological advances rather than policy or social factors",
            "Limited regional analysis of solar adoption and challenges",
            "Minimal evaluation of comparative advantages against other renewable sources",
            "Some sources have reliability below the requested minimum",
            "Some findings have low confidence"
          ],
          future_research_directions: [
            "Long-term durability and performance of new solar technologies",
            "Environmental lifecycle analysis of advanced solar materials",
            "Integration strategies for high solar penetration in existing grids"
          ]
        });
      } else if (prompt.includes('invalid json test')) {
        return 'This is not valid JSON';
      } else if (prompt.includes('reliability validation')) {
        return JSON.stringify({
          query: "reliability validation",
          topic_type: ResearchTopicType.GENERAL,
          sources: [
            {
              id: "source-1",
              title: "Low reliability source",
              type: SourceType.ARTICLE,
              reliability: ReliabilityRating.LOW,
              key_points: ["Test point"]
            }
          ],
          findings: [],
          analysis: { patterns: [], gaps: [], controversies: [], consensus: [], emerging_trends: [] },
          key_takeaways: [],
          summary: "Test summary",
          confidence_score: 0.5,
          limitations: ["Some sources have reliability below the requested minimum"],
          future_research_directions: []
        });
      }
      
      return '{}';
    });
    
    // Also mock the generate method for completeness
    llmProvider.generate = llmProvider.chat;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct properties', () => {
    const research = new Research({
      name: 'Research',
      llm: llmProvider,
      memory: new ArrayMemory()
    });

    expect(research.name).toBe('Research');
    expect(research.desc).toContain('research');
  });

  it('should perform research successfully', async () => {
    const research = new Research({
      name: 'Research',
      llm: llmProvider,
      memory: new ArrayMemory(),
      args: {
        query: 'Recent advances in solar energy technology',
        topic_type: ResearchTopicType.TECHNICAL,
        objective: 'Analyze recent developments and trends in solar energy technology'
      }
    });

    const result = await research.run();
    expect(result.status).toBe('completed');

    const content = result.instructContent as ResearchResult;
    expect(content.query).toBe('Recent advances in solar energy technology');
    expect(content.topic_type).toBe(ResearchTopicType.TECHNICAL);
    expect(content.sources.length).toBeGreaterThan(0);
    expect(content.findings.length).toBeGreaterThan(0);
  });

  it('should fail when no query is provided', async () => {
    const research = new Research({
      name: 'Research',
      llm: llmProvider,
      memory: new ArrayMemory()
    });

    const result = await research.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No research query provided');
  });

  it('should validate research result structure', async () => {
    const research = new Research({
      name: 'Research',
      llm: llmProvider,
      memory: new ArrayMemory(),
      args: {
        query: 'Recent advances in solar energy technology',
        topic_type: ResearchTopicType.TECHNICAL
      }
    });

    const result = await research.run();
    const content = result.instructContent as ResearchResult;

    // Validate required fields
    expect(content).toHaveProperty('query');
    expect(content).toHaveProperty('topic_type');
    expect(content).toHaveProperty('sources');
    expect(content).toHaveProperty('findings');
    expect(content).toHaveProperty('analysis');
    expect(content).toHaveProperty('key_takeaways');
    expect(content).toHaveProperty('summary');
    expect(content).toHaveProperty('confidence_score');
  });

  it('should handle LLM errors gracefully', async () => {
    // Make LLM throw error
    llmProvider.chat = vi.fn().mockRejectedValueOnce(new Error('LLM API error'));
    llmProvider.generate = vi.fn().mockRejectedValueOnce(new Error('LLM API error'));

    const research = new Research({
      name: 'Research',
      llm: llmProvider,
      memory: new ArrayMemory(),
      args: {
        query: 'Recent advances in solar energy technology',
        topic_type: ResearchTopicType.TECHNICAL
      }
    });

    const result = await research.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Failed to perform research');
  });

  it('should apply source reliability validation', async () => {
    const research = new Research({
      name: 'Research',
      llm: llmProvider,
      memory: new ArrayMemory(),
      args: {
        query: 'reliability validation',
        min_reliability: ReliabilityRating.MEDIUM
      }
    });

    const result = await research.run();
    const content = result.instructContent as ResearchResult;

    expect(content.limitations).toBeDefined();
    expect(content.limitations.some(limitation => 
      limitation.includes('sources have reliability below the requested minimum')
    )).toBe(true);
  });

  it('should check findings confidence and add warnings for low confidence', async () => {
    const research = new Research({
      name: 'Research',
      llm: llmProvider,
      memory: new ArrayMemory(),
      args: {
        query: 'Recent advances in solar energy technology'
      }
    });
    
    const result = await research.run();
    const content = result.instructContent as ResearchResult;

    expect(content.limitations).toBeDefined();
    expect(content.limitations.some(limitation => 
      limitation.includes('findings have low confidence')
    )).toBe(true);
  });
}); 