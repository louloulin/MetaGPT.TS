/**
 * Unit tests for Research action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Research, ResearchTopicType, SourceType, ReliabilityRating } from '../../src/actions/research';
import type { ResearchResult, ResearchConfig } from '../../src/actions/research';
import { ArrayMemory } from '../../src/types/memory';

// Create a mock memory for testing
const createMockMemory = () => {
  return new ArrayMemory();
};

// Mock LLM provider
const mockLLM = {
  chat: vi.fn(),
  getName: () => 'MockLLM',
  getModel: () => 'test-model',
  generate: vi.fn(),
  ask: vi.fn().mockImplementation(async (prompt: string) => {
    // Mock response for technology research
    if (prompt.includes('TypeScript')) {
      return JSON.stringify({
        query: "What are the key features and benefits of TypeScript?",
        topic_type: "TECHNICAL",
        objective: "Research information about TypeScript, its features, benefits, and use cases",
        
        sources: [
          {
            id: "source-1",
            title: "TypeScript Official Documentation",
            url: "https://www.typescriptlang.org/docs/",
            author: "Microsoft",
            publicationDate: "2023",
            type: "DOCUMENTATION",
            reliability: "HIGH",
            key_points: [
              "TypeScript is a strongly typed programming language that builds on JavaScript",
              "TypeScript compiles to readable JavaScript",
              "TypeScript is open source and maintained by Microsoft"
            ]
          },
          {
            id: "source-2",
            title: "Understanding TypeScript",
            author: "Maximilian Schwarzmüller",
            type: "ARTICLE",
            reliability: "MEDIUM",
            key_points: [
              "TypeScript adds static type definitions to JavaScript",
              "TypeScript helps catch errors during development rather than at runtime",
              "TypeScript offers better IDE support and code navigation"
            ]
          },
          {
            id: "source-3",
            title: "TypeScript GitHub Repository",
            url: "https://github.com/microsoft/TypeScript",
            author: "Microsoft and contributors",
            type: "CODE_REPOSITORY",
            reliability: "HIGH",
            key_points: [
              "TypeScript has over 80,000 stars on GitHub",
              "Active development with regular releases",
              "Extensive community support and contributions"
            ]
          }
        ],
        
        findings: [
          {
            id: "finding-1",
            topic: "Type System",
            description: "TypeScript provides a static type system that allows developers to define types for variables, function parameters, and return values. This helps catch type-related errors during development rather than at runtime.",
            source_ids: ["source-1", "source-2"],
            confidence: 0.95
          },
          {
            id: "finding-2",
            topic: "Compatibility with JavaScript",
            description: "TypeScript is a superset of JavaScript, meaning any valid JavaScript code is also valid TypeScript code. This allows for gradual adoption and easy integration with existing JavaScript projects.",
            source_ids: ["source-1", "source-3"],
            confidence: 0.9
          },
          {
            id: "finding-3",
            topic: "Development Tools",
            description: "TypeScript provides enhanced IDE support, including better code completion, navigation, and refactoring tools. This improves developer productivity and code quality.",
            source_ids: ["source-2"],
            confidence: 0.85
          },
          {
            id: "finding-4",
            topic: "Ecosystem",
            description: "TypeScript has a growing ecosystem with strong community support and integration with popular frameworks and libraries like React, Angular, and Vue.",
            source_ids: ["source-3"],
            confidence: 0.8
          }
        ],
        
        analysis: {
          patterns: [
            "Strong emphasis on developer experience and productivity",
            "Focus on enterprise-grade applications and large codebases",
            "Gradual adoption path from JavaScript to TypeScript"
          ],
          gaps: [
            "Limited information on performance implications",
            "Few details on advanced type system features",
            "Limited comparison with other statically typed languages"
          ],
          controversies: [
            "Some developers argue that the additional syntax adds complexity",
            "Debate over whether the benefits outweigh the learning curve for small projects"
          ],
          consensus: [
            "TypeScript improves code quality and maintainability",
            "TypeScript is particularly valuable for large, complex applications",
            "The static type system helps catch errors early"
          ],
          emerging_trends: [
            "Increasing adoption in front-end frameworks",
            "Growing use in Node.js back-end development",
            "Enhanced integration with package ecosystems"
          ]
        },
        
        key_takeaways: [
          "TypeScript adds static typing to JavaScript, helping catch errors during development",
          "TypeScript is compatible with existing JavaScript, allowing for gradual adoption",
          "TypeScript offers improved developer tools and productivity features",
          "TypeScript is particularly beneficial for large, complex applications"
        ],
        summary: "TypeScript is a strongly typed programming language developed and maintained by Microsoft that builds on JavaScript. It adds static type checking and other features that help catch errors during development rather than at runtime. As a superset of JavaScript, TypeScript allows for gradual adoption in existing projects. It offers significant benefits for development productivity through enhanced IDE support, code navigation, and refactoring tools. While there is some debate about its value in smaller projects, there is consensus that TypeScript significantly improves code quality and maintainability in larger, more complex applications. The ecosystem continues to grow with increasing adoption in both front-end and back-end development.",
        
        confidence_score: 0.9,
        limitations: [
          "Research is primarily based on official documentation and community sources",
          "Limited analysis of real-world case studies and implementation challenges",
          "Minimal exploration of performance implications"
        ],
        future_research_directions: [
          "Comparative analysis with other type systems",
          "Investigation of TypeScript in specific domains (e.g., game development, IoT)",
          "Quantitative studies on productivity improvements"
        ]
      });
    } 
    // Mock response for scientific research
    else if (prompt.includes('solar energy')) {
      return JSON.stringify({
        query: "What are recent advances in solar energy technology?",
        topic_type: "SCIENTIFIC",
        objective: "Research recent developments and breakthroughs in solar energy technology",
        
        sources: [
          {
            id: "source-1",
            title: "Advances in Photovoltaic Technology",
            author: "Journal of Renewable Energy",
            publicationDate: "2022",
            type: "ACADEMIC_PAPER",
            reliability: "HIGH",
            key_points: [
              "Perovskite solar cells have reached efficiency over 25%",
              "Tandem solar cells combine multiple materials to capture more of the solar spectrum",
              "Quantum dot solar cells show promise for next-generation photovoltaics"
            ]
          },
          {
            id: "source-2",
            title: "Solar Energy Market Report",
            author: "International Energy Agency",
            publicationDate: "2023",
            type: "ARTICLE",
            reliability: "HIGH",
            key_points: [
              "Solar PV capacity has grown exponentially in the last decade",
              "Costs have decreased by over 80% since 2010",
              "Grid integration challenges are being addressed with improved storage technologies"
            ]
          },
          {
            id: "source-3",
            title: "Emerging Solar Technologies Database",
            author: "National Renewable Energy Laboratory",
            publicationDate: "2023",
            type: "DATASET",
            reliability: "HIGH",
            key_points: [
              "Bifacial solar panels can generate up to 30% more electricity",
              "Building-integrated photovoltaics are becoming more efficient and aesthetically pleasing",
              "Floating solar farms are expanding rapidly in Asia and Europe"
            ]
          }
        ],
        
        findings: [
          {
            id: "finding-1",
            topic: "Efficiency Improvements",
            description: "Recent advances in materials science, particularly perovskite and tandem solar cells, have pushed solar cell efficiency beyond 25%, approaching the theoretical limits for single-junction silicon cells.",
            source_ids: ["source-1"],
            confidence: 0.9
          },
          {
            id: "finding-2",
            topic: "Cost Reduction",
            description: "Solar energy costs have decreased dramatically, with an 80% reduction since 2010, making it competitive with or cheaper than fossil fuels in many regions without subsidies.",
            source_ids: ["source-2"],
            confidence: 0.95
          },
          {
            id: "finding-3",
            topic: "Novel Deployment Methods",
            description: "Innovative deployment approaches such as bifacial panels, building-integrated photovoltaics, and floating solar farms are expanding the potential for solar energy integration in diverse environments.",
            source_ids: ["source-3"],
            confidence: 0.85
          }
        ],
        
        analysis: {
          patterns: [
            "Convergence of efficiency improvements and cost reductions",
            "Increased integration with existing infrastructure",
            "Focus on addressing intermittency through storage solutions"
          ],
          gaps: [
            "Limited information on large-scale grid integration challenges",
            "Few details on recycling and end-of-life management",
            "Minimal discussion of rare material constraints"
          ],
          controversies: [
            "Debate over government subsidies and incentives",
            "Questions about environmental impact of manufacturing and disposal"
          ],
          consensus: [
            "Solar energy is increasingly cost-competitive with conventional sources",
            "Technological advances continue to improve efficiency and applicability",
            "Storage solutions are critical for wider adoption"
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
          "Minimal evaluation of comparative advantages against other renewable sources"
        ],
        future_research_directions: [
          "Long-term durability and performance of new solar technologies",
          "Environmental lifecycle analysis of advanced solar materials",
          "Integration strategies for high solar penetration in existing grids"
        ]
      });
    }
    // Mock response for invalid JSON
    else if (prompt.includes('invalid json')) {
      return 'This is not valid JSON';
    }
    // Default fallback response
    else {
      return JSON.stringify({
        query: "Unspecified research query",
        topic_type: "GENERAL",
        objective: "Research the provided topic",
        
        sources: [
          {
            id: "source-1",
            title: "General information source",
            type: "ARTICLE",
            reliability: "MEDIUM",
            key_points: ["Limited information available on this topic"]
          }
        ],
        
        findings: [
          {
            id: "finding-1",
            topic: "General finding",
            description: "No specific findings could be generated for this query",
            source_ids: ["source-1"],
            confidence: 0.5
          }
        ],
        
        analysis: {
          patterns: [],
          gaps: ["Insufficient specific information available"],
          controversies: [],
          consensus: [],
          emerging_trends: []
        },
        
        key_takeaways: ["More specific research query needed"],
        summary: "The research query was too general or unclear to provide detailed insights. Please refine the query with more specific parameters.",
        
        confidence_score: 0.3,
        limitations: [
          "Query lacks specificity",
          "Limited relevant information available"
        ],
        future_research_directions: [
          "Refine the research question",
          "Specify particular aspects of interest"
        ]
      });
    }
  })
};

describe('Research', () => {
  let research: Research;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create Research instance with mock LLM
    research = new Research({
      name: 'Research',
      llm: mockLLM,
      memory: createMockMemory()
    });
    
    // Setup the ask method from BaseAction
    (research as any).ask = mockLLM.ask;
  });
  
  it('should create a Research instance', () => {
    expect(research).toBeInstanceOf(Research);
  });
  
  it('should fail when no query is provided', async () => {
    // Run the action without providing a query
    const result = await research.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No research query provided');
  });
  
  it('should research technical topics and provide structured information', async () => {
    // Create Research instance with a technical question
    const typescriptResearch = new Research({
      name: 'Research',
      llm: mockLLM,
      memory: createMockMemory(),
      args: {
        query: 'What are the key features and benefits of TypeScript?',
        topic_type: ResearchTopicType.TECHNICAL
      }
    });
    
    // Setup the ask method
    (typescriptResearch as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await typescriptResearch.run();
    
    // Verify that research was performed correctly
    expect(result.status).toBe('completed');
    expect(result.content).toContain('TypeScript');
    expect(result.content).toContain('Information Sources');
    expect(result.content).toContain('Research Findings');
    
    // Verify that the instructContent contains the ResearchResult
    const researchResult = result.instructContent as ResearchResult;
    expect(researchResult.query).toContain('TypeScript');
    expect(researchResult.topic_type).toBe('TECHNICAL');
    expect(researchResult.sources.length).toBe(3);
    expect(researchResult.findings.length).toBe(4);
    expect(researchResult.key_takeaways.length).toBeGreaterThan(0);
    expect(researchResult.confidence_score).toBeGreaterThan(0.8);
  });
  
  it('should research scientific topics and provide analysis', async () => {
    // Create Research instance with a scientific question
    const solarResearch = new Research({
      name: 'Research',
      llm: mockLLM,
      args: {
        query: 'What are recent advances in solar energy technology?',
        topic_type: ResearchTopicType.SCIENTIFIC,
        max_sources: 5
      }
    });
    
    // Setup the ask method
    (solarResearch as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await solarResearch.run();
    
    // Verify the research result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('solar energy');
    
    // Check specific elements of research
    const researchResult = result.instructContent as ResearchResult;
    expect(researchResult.topic_type).toBe('SCIENTIFIC');
    expect(researchResult.sources.some(source => source.type === 'ACADEMIC_PAPER')).toBe(true);
    expect(researchResult.analysis.emerging_trends.length).toBeGreaterThan(0);
    expect(researchResult.confidence_score).toBeGreaterThan(0.8);
  });
  
  it('should include focus areas in the research prompt when specified', async () => {
    // Spy on the constructResearchPrompt method
    const promptSpy = vi.spyOn(Research.prototype as any, 'constructResearchPrompt');
    
    // Create Research instance with focus areas
    const focusedResearch = new Research({
      name: 'Research',
      llm: mockLLM,
      args: {
        query: 'What are the best practices for web accessibility?',
        topic_type: ResearchTopicType.TECHNICAL,
        focus_areas: ['ARIA standards', 'Screen reader compatibility', 'Keyboard navigation']
      }
    });
    
    // Setup the ask method
    (focusedResearch as any).ask = mockLLM.ask;
    
    // Execute the action
    await focusedResearch.run();
    
    // Check that focus areas were included in the prompt
    expect(promptSpy).toHaveBeenCalled();
    const promptCall = promptSpy.mock.calls[0][0] as ResearchConfig;
    expect(promptCall.focus_areas).toHaveLength(3);
    expect(promptCall.focus_areas).toContain('ARIA standards');
  });
  
  it('should handle LLM response parsing errors gracefully', async () => {
    // Create Research instance with input that will trigger invalid JSON
    const invalidJsonResearch = new Research({
      name: 'Research',
      llm: mockLLM,
      args: {
        query: 'This will trigger invalid json response',
      }
    });
    
    // Setup the ask method
    (invalidJsonResearch as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await invalidJsonResearch.run();
    
    // Verify that a fallback result was created
    expect(result.status).toBe('completed');
    expect(result.content).toContain('research could not be completed due to an error');
    
    // Verify the fallback research result structure
    const fallbackResult = result.instructContent as ResearchResult;
    expect(fallbackResult.query).toBe('This will trigger invalid json response');
    expect(fallbackResult.sources.length).toBe(1);
    expect(fallbackResult.sources[0].reliability).toBe(ReliabilityRating.UNKNOWN);
    expect(fallbackResult.confidence_score).toBe(0);
  });
  
  it('should apply source reliability validation', async () => {
    // Mock implementation to return a result with low reliability sources
    mockLLM.ask.mockImplementationOnce(async () => {
      return JSON.stringify({
        query: "Test query with low reliability sources",
        topic_type: "GENERAL",
        objective: "Test research",
        
        sources: [
          {
            id: "source-1",
            title: "Low reliability source",
            type: SourceType.ARTICLE,
            reliability: ReliabilityRating.LOW,
            key_points: ["Test point"]
          },
          {
            id: "source-2",
            title: "Unknown reliability source",
            type: SourceType.WEBSITE,
            reliability: ReliabilityRating.UNKNOWN,
            key_points: ["Test point"]
          }
        ],
        
        findings: [
          {
            id: "finding-1",
            topic: "Test finding",
            description: "Test description",
            source_ids: ["source-1"],
            confidence: 0.6
          }
        ],
        
        analysis: {
          patterns: [],
          gaps: [],
          controversies: [],
          consensus: [],
          emerging_trends: []
        },
        
        key_takeaways: ["Test takeaway"],
        summary: "Test summary",
        
        confidence_score: 0.5,
        limitations: [],
        future_research_directions: []
      });
    });
    
    // Create Research instance with high reliability requirement
    const reliabilityResearch = new Research({
      name: 'Research',
      llm: mockLLM,
      args: {
        query: 'Test query for reliability validation',
        min_reliability: ReliabilityRating.MEDIUM
      }
    });
    
    // Setup the ask method
    (reliabilityResearch as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await reliabilityResearch.run();
    
    // Verify the result contains reliability limitations
    const researchResult = result.instructContent as ResearchResult;
    expect(researchResult.limitations).toContain(expect.stringContaining('sources have reliability below'));
  });
  
  it('should format research results into readable markdown', async () => {
    // Create Research instance with a basic query
    const basicResearch = new Research({
      name: 'Research',
      llm: mockLLM,
      args: {
        query: 'What are the key features and benefits of TypeScript?'
      }
    });
    
    // Setup the ask method
    (basicResearch as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await basicResearch.run();
    
    // Check markdown formatting
    expect(result.content).toMatch(/^# Research Report:/);
    expect(result.content).toContain('## Research Overview');
    expect(result.content).toContain('## Information Sources');
    expect(result.content).toContain('## Research Findings');
    expect(result.content).toContain('## Analysis');
    expect(result.content).toContain('## Key Takeaways');
    expect(result.content).toContain('## Summary');
    
    // Verify that source links are properly formatted
    if (result.content.includes('**Link:**')) {
      expect(result.content).toMatch(/\[https:\/\/[^\]]+\]\([^)]+\)/);
    }
  });
  
  it('should check findings confidence and add warnings for low confidence', async () => {
    // Mock implementation to return a result with low confidence findings
    mockLLM.ask.mockImplementationOnce(async () => {
      return JSON.stringify({
        query: "Test query with low confidence findings",
        topic_type: "GENERAL",
        objective: "Test research",
        
        sources: [
          {
            id: "source-1",
            title: "Test source",
            type: SourceType.ARTICLE,
            reliability: ReliabilityRating.MEDIUM,
            key_points: ["Test point"]
          }
        ],
        
        findings: [
          {
            id: "finding-1",
            topic: "Low confidence finding 1",
            description: "This finding has low confidence",
            source_ids: ["source-1"],
            confidence: 0.3
          },
          {
            id: "finding-2",
            topic: "Low confidence finding 2",
            description: "This finding also has low confidence",
            source_ids: ["source-1"],
            confidence: 0.4
          }
        ],
        
        analysis: {
          patterns: [],
          gaps: [],
          controversies: [],
          consensus: [],
          emerging_trends: []
        },
        
        key_takeaways: ["Test takeaway"],
        summary: "Test summary",
        
        confidence_score: 0.5,
        limitations: [],
        future_research_directions: []
      });
    });
    
    // Create Research instance
    const confidenceResearch = new Research({
      name: 'Research',
      llm: mockLLM,
      args: {
        query: 'Test query for confidence validation'
      }
    });
    
    // Setup the ask method
    (confidenceResearch as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await confidenceResearch.run();
    
    // Verify the result contains confidence warnings
    const researchResult = result.instructContent as ResearchResult;
    expect(researchResult.limitations).toContain(expect.stringContaining('findings have low confidence'));
  });
}); 