/**
 * Unit tests for Research action
 */

import { expect, describe, it, vi, beforeEach } from 'vitest';
import { Research, type ResearchResult, ReliabilityRating, ResearchTopicType, SourceType } from '../../src/actions/research';
import type { ActionOutput } from '../../src/types/action';

// Create a mock object for testing
describe('Research', () => {
  let mockLLM: any;

  beforeEach(() => {
    // Reset mocks before each test
    mockLLM = {
      generate: vi.fn(),
      ask: vi.fn()
    };

    // Set up mock implementation for technical research
    const technicalResearchResponse = {
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
    };

    // Set up mock implementation for scientific research
    const scientificResearchResponse = {
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
    };

    // Set up mock implementation for reliable source validation
    const reliabilityValidationResponse = {
      query: "Test query for reliability validation",
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
    };

    // Set up mock implementation for confidence validation
    const confidenceValidationResponse = {
      query: "Test query for confidence validation",
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
    };

    // Mock setup for returning particular responses based on the prompt content
    mockLLM.generate.mockImplementation((prompt: string) => {
      if (prompt.includes('TypeScript')) {
        return JSON.stringify(technicalResearchResponse);
      } else if (prompt.includes('solar energy')) {
        return JSON.stringify(scientificResearchResponse);
      } else if (prompt.includes('reliability validation')) {
        return JSON.stringify(reliabilityValidationResponse);
      } else if (prompt.includes('confidence validation')) {
        return JSON.stringify(confidenceValidationResponse);
      } else if (prompt.includes('invalid json')) {
        return 'Invalid JSON response';
      } else {
        return JSON.stringify({
          query: prompt,
          topic_type: ResearchTopicType.GENERAL,
          objective: "Research the provided topic",
          sources: [],
          findings: [],
          analysis: {
            patterns: [],
            gaps: [],
            controversies: [],
            consensus: [],
            emerging_trends: []
          },
          key_takeaways: [],
          summary: "No specific findings for this query.",
        confidence_score: 0.5,
        limitations: [],
        future_research_directions: []
      });
      }
    });

    // Use the same mock implementation for the ask method
    mockLLM.ask.mockImplementation(mockLLM.generate);
  });

  it('should research a technical topic', async () => {
    // Create a new Research instance
    const research = new Research({
      name: 'TestResearch',
      llm: mockLLM,
      args: {
        query: 'What are the key features and benefits of TypeScript?',
        topic_type: ResearchTopicType.TECHNICAL,
      }
    });

    // Execute the action
    const result = await research.run() as ActionOutput;
    const researchResult = result.instructContent as ResearchResult;

    // Verifications
    expect(researchResult).toBeDefined();
    expect(researchResult.topic_type).toBe(ResearchTopicType.TECHNICAL);
    expect(researchResult.sources.length).toBeGreaterThan(0);
    expect(researchResult.findings.length).toBeGreaterThan(0);
  });

  it('should research a scientific topic', async () => {
    // Create a new Research instance
    const research = new Research({
      name: 'TestResearch',
      llm: mockLLM,
      args: {
        query: 'What are recent advances in solar energy technology?',
        topic_type: ResearchTopicType.SCIENTIFIC,
      }
    });

    // Execute the action
    const result = await research.run() as ActionOutput;
    const researchResult = result.instructContent as ResearchResult;

    // Verifications
    expect(researchResult).toBeDefined();
    expect(researchResult.topic_type).toBe(ResearchTopicType.SCIENTIFIC);
    expect(researchResult.sources.some(source => source.type === 'ACADEMIC_PAPER')).toBe(true);
    expect(researchResult.analysis.emerging_trends.length).toBeGreaterThan(0);
  });

  it('should include focus areas in research prompt', async () => {
    // Create a new Research instance
    const research = new Research({
      name: 'TestResearch',
      llm: mockLLM,
      args: {
        query: 'What are the key features and benefits of TypeScript?',
        topic_type: ResearchTopicType.TECHNICAL,
        focus_areas: ['Type system', 'Developer experience']
      }
    });

    // Execute the action
    await research.run();

    // Verify that the focus areas were included in the prompt
    const callArgs = mockLLM.generate.mock.calls[0][0];
    expect(callArgs).toContain('Type system');
    expect(callArgs).toContain('Developer experience');
  });

  it('should handle LLM response parsing errors', async () => {
    // Create a new Research instance
    const research = new Research({
      name: 'TestResearch',
      llm: mockLLM,
      args: {
        query: 'invalid json test',
      }
    });

    // Execute the action
    const result = await research.run() as ActionOutput;
    const researchResult = result.instructContent as ResearchResult;

    // Verify fallback result structure
    expect(researchResult.query).toBe('invalid json test');
    expect(researchResult.topic_type).toBe(ResearchTopicType.GENERAL);
    expect(researchResult.sources).toHaveLength(1);
    expect(researchResult.findings).toHaveLength(1);
    expect(researchResult.limitations).toBeDefined();
    expect(researchResult.limitations.length).toBeGreaterThan(0);
  });

  it('should apply source reliability validation', async () => {
    // Create a new Research instance with high reliability requirement
    const research = new Research({
      name: 'TestResearch',
      llm: mockLLM,
      args: {
        query: 'reliability validation',
        min_reliability: ReliabilityRating.MEDIUM
      }
    });

    // Execute the action
    const result = await research.run() as ActionOutput;
    const researchResult = result.instructContent as ResearchResult;

    // Verify that the result contains limitations regarding reliability
    expect(researchResult.limitations).toBeDefined();
    expect(researchResult.limitations.some(limitation => 
      limitation.includes('sources have reliability below the requested minimum')
    )).toBe(true);
  });

  it('should check findings confidence and add warnings for low confidence', async () => {
    // Create a new Research instance
    const research = new Research({
      name: 'TestResearch',
      llm: mockLLM,
      args: {
        query: 'confidence validation',
      }
    });
    
    // Execute the action
    const result = await research.run() as ActionOutput;
    const researchResult = result.instructContent as ResearchResult;

    // Verify that the result contains limitations regarding findings confidence
    expect(researchResult.limitations).toBeDefined();
    expect(researchResult.limitations.some(limitation => 
      limitation.includes('findings have low confidence')
    )).toBe(true);
  });

  it('should format research result to markdown', async () => {
    // Create a new Research instance
    const research = new Research({
      name: 'TestResearch',
      llm: mockLLM,
      args: {
        query: 'What are the key features and benefits of TypeScript?',
      }
    });

    // Execute the action
    const result = await research.run() as ActionOutput;
    const researchResult = result.instructContent as ResearchResult;

    // Access the formatted markdown directly from the content field
    const formattedOutput = result.content;

    // Verify markdown formatting
    expect(formattedOutput).toContain('# Research Report:');
    expect(formattedOutput).toContain('Research Overview');
    expect(formattedOutput).toContain('Information Sources');
    expect(formattedOutput).toContain('Research Findings');
    expect(formattedOutput).toContain('Analysis');
    expect(formattedOutput).toContain('Key Takeaways');
    expect(formattedOutput).toContain('Limitations');
  });
}); 