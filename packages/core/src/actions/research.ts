/**
 * Research Action
 * 
 * This action performs information gathering, analysis, and synthesis to research
 * topics or questions, providing structured research results and summaries.
 */

import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Research topic type
 */
export enum ResearchTopicType {
  TECHNICAL = 'TECHNICAL',       // Technical topics like programming, engineering, etc.
  SCIENTIFIC = 'SCIENTIFIC',     // Scientific research topics
  BUSINESS = 'BUSINESS',         // Business, market research, trends
  ACADEMIC = 'ACADEMIC',         // Academic research
  GENERAL = 'GENERAL'            // General knowledge
}

/**
 * Information source type
 */
export enum SourceType {
  WEBSITE = 'WEBSITE',
  ACADEMIC_PAPER = 'ACADEMIC_PAPER',
  BOOK = 'BOOK',
  ARTICLE = 'ARTICLE',
  DOCUMENTATION = 'DOCUMENTATION',
  CODE_REPOSITORY = 'CODE_REPOSITORY',
  VIDEO = 'VIDEO',
  PODCAST = 'PODCAST',
  INTERVIEW = 'INTERVIEW',
  SURVEY = 'SURVEY',
  DATASET = 'DATASET',
  API = 'API',
  OTHER = 'OTHER'
}

/**
 * Source reliability rating
 */
export enum ReliabilityRating {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Information source
 */
export interface Source {
  id: string;
  title: string;
  url?: string;
  author?: string;
  publicationDate?: string;
  type: SourceType;
  reliability: ReliabilityRating;
  key_points: string[];
}

/**
 * Research finding
 */
export interface Finding {
  id: string;
  topic: string;
  description: string;
  source_ids: string[];
  confidence: number; // 0-1 confidence score
  contradicting_findings?: string[]; // IDs of contradicting findings
}

/**
 * Structured analysis of collected information
 */
export interface Analysis {
  patterns: string[];
  gaps: string[];
  controversies: string[];
  consensus: string[];
  emerging_trends: string[];
}

/**
 * Final research result
 */
export interface ResearchResult {
  // Research overview
  query: string;
  topic_type: ResearchTopicType;
  objective: string;
  
  // Information collection
  sources: Source[];
  
  // Research findings
  findings: Finding[];
  
  // Analysis
  analysis: Analysis;
  
  // Synthesis
  key_takeaways: string[];
  summary: string;
  
  // Metadata
  confidence_score: number; // 0-1 overall confidence in the research
  limitations: string[];
  future_research_directions: string[];
}

/**
 * Configuration for the research process
 */
export interface ResearchConfig {
  query: string;
  topic_type?: ResearchTopicType;
  objective?: string;
  max_sources?: number;
  min_reliability?: ReliabilityRating;
  focus_areas?: string[];
  excluded_sources?: string[];
  time_constraints?: string;
}

/**
 * Action for performing research and information synthesis
 */
export class Research extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'Research',
      description: config.description || 'Gathers, analyzes, and synthesizes information to research topics or questions',
    });
  }

  /**
   * Runs the Research action
   * @returns The research results
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running Research action`);
      
      // Get the query from the context
      const query = this.getArg<string>('query');
      
      if (!query) {
        throw new Error('No research query provided. Please provide a topic or question to research.');
      }

      // Get optional configuration
      const topicType = this.getArg<ResearchTopicType>('topic_type') || ResearchTopicType.GENERAL;
      const objective = this.getArg<string>('objective') || `Research information about: ${query}`;
      const maxSources = this.getArg<number>('max_sources') || 10;
      const minReliability = this.getArg<ReliabilityRating>('min_reliability') || ReliabilityRating.MEDIUM;
      const focusAreas = this.getArg<string[]>('focus_areas') || [];
      const excludedSources = this.getArg<string[]>('excluded_sources') || [];
      const timeConstraints = this.getArg<string>('time_constraints') || '';

      // Perform the research
      const researchResult = await this.performResearch({
        query,
        topic_type: topicType,
        objective,
        max_sources: maxSources,
        min_reliability: minReliability,
        focus_areas: focusAreas,
        excluded_sources: excludedSources,
        time_constraints: timeConstraints
      });

      // Format the research result
      const formattedResult = JSON.stringify(researchResult);
      
      return this.createOutput(
        formattedResult,
        'completed'
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in Research action:`, error);
      throw error;
    }
  }

  /**
   * Performs the research process
   * @param config The research configuration
   * @returns The research result
   */
  private async performResearch(config: ResearchConfig): Promise<ResearchResult> {
    try {
      logger.info(`[${this.name}] Performing research for query: ${config.query}`);
      
      // Construct the research prompt
      const prompt = this.constructResearchPrompt(config);
      
      // Send to LLM for research
      const response = await this.llm?.generate(prompt);
      
      if (!response) {
        throw new Error('Failed to get response from LLM');
      }
      
      // Parse the research result
      let result: ResearchResult;
      try {
        logger.info(`[${this.name}] Research result: ${response}`);
        result = JSON.parse(response);
        
        // Ensure all required fields exist
        if (!result.query || !result.sources || !result.findings || !result.analysis || 
            !result.key_takeaways || !result.summary || !result.limitations || 
            !result.future_research_directions) {
          throw new Error('Missing required fields in research result');
        }
        
        // Only set the topic_type if not provided by the LLM response
        if (!result.topic_type) {
          result.topic_type = config.topic_type || ResearchTopicType.GENERAL;
        }
        
        // Ensure confidence_score exists and is valid
        if (typeof result.confidence_score !== 'number' || 
            result.confidence_score < 0 || 
            result.confidence_score > 1) {
          result.confidence_score = 0.5; // Set default confidence score
        }
        
        // Validate the research result
        this.validateResearchResult(result, config);
        
        return result;
      } catch (parseError: unknown) {
        logger.error(`[${this.name}] Failed to parse research result:`, parseError);
        throw parseError;
      }
    } catch (error) {
      logger.error(`[${this.name}] Error performing research:`, error);
      throw error;
    }
  }

  /**
   * Validates the research result to ensure it meets requirements
   * @param result The research result to validate
   * @param config The research configuration
   */
  private validateResearchResult(result: ResearchResult, config: ResearchConfig): void {
    // Initialize limitations array if it doesn't exist
    if (!result.limitations) {
      result.limitations = [];
    }
    
    // Validate sources
    result.sources = result.sources.map(source => ({
      ...source,
      reliability: source.reliability || ReliabilityRating.UNKNOWN,
      key_points: source.key_points || []
    }));
    
    // Check if sources meet minimum reliability requirements
    const lowReliabilitySources = result.sources.filter(source => 
      this.getReliabilityScore(source.reliability) < this.getReliabilityScore(config.min_reliability!)
    );
    
    if (lowReliabilitySources.length > 0) {
      logger.warn(`[${this.name}] ${lowReliabilitySources.length} sources have reliability below the minimum threshold`);
      result.limitations.push(`${lowReliabilitySources.length} sources have reliability below the requested minimum of ${config.min_reliability}`);
    }
    
    // Validate findings
    result.findings = result.findings.map(finding => ({
      ...finding,
      confidence: typeof finding.confidence === 'number' ? finding.confidence : 0.5,
      source_ids: finding.source_ids || []
    }));
    
    // Check if we have enough findings
    if (result.findings.length === 0) {
      logger.warn(`[${this.name}] No findings were generated for the research query`);
      result.limitations.push('No specific findings were generated for this research query');
    }
    
    // Check if any findings have low confidence
    const lowConfidenceFindings = result.findings.filter(finding => finding.confidence < 0.5);
    if (lowConfidenceFindings.length > 0) {
      logger.warn(`[${this.name}] ${lowConfidenceFindings.length} findings have low confidence (<0.5)`);
      result.limitations.push(`${lowConfidenceFindings.length} findings have low confidence and should be verified with additional research`);
    }
    
    // Validate analysis
    result.analysis = {
      patterns: result.analysis.patterns || [],
      gaps: result.analysis.gaps || [],
      controversies: result.analysis.controversies || [],
      consensus: result.analysis.consensus || [],
      emerging_trends: result.analysis.emerging_trends || []
    };
  }

  /**
   * Gets a numeric score for reliability ratings
   * @param rating The reliability rating
   * @returns A numeric score (0-3)
   */
  private getReliabilityScore(rating: ReliabilityRating): number {
    const scores: Record<ReliabilityRating, number> = {
      [ReliabilityRating.HIGH]: 3,
      [ReliabilityRating.MEDIUM]: 2,
      [ReliabilityRating.LOW]: 1,
      [ReliabilityRating.UNKNOWN]: 0
    };
    
    return scores[rating];
  }

  /**
   * Constructs a prompt for the research process
   * @param config The research configuration
   * @returns The constructed prompt
   */
  private constructResearchPrompt(config: ResearchConfig): string {
    // Format focus areas if provided
    const focusAreasText = config.focus_areas && config.focus_areas.length > 0
      ? `Focus areas for this research:\n${config.focus_areas.map(area => `- ${area}`).join('\n')}\n\n`
      : '';
    
    // Format excluded sources if provided
    const excludedSourcesText = config.excluded_sources && config.excluded_sources.length > 0
      ? `Excluded sources (do not use these):\n${config.excluded_sources.map(source => `- ${source}`).join('\n')}\n\n`
      : '';
    
    // Format time constraints if provided
    const timeConstraintsText = config.time_constraints
      ? `Time constraints: ${config.time_constraints}\n\n`
      : '';
    
    // Construct the prompt
    return `
    # Research Task

    ## Research Query
    ${config.query}

    ## Research Objective
    ${config.objective}

    ## Topic Type
    ${config.topic_type}
    
    ${focusAreasText}
    ${excludedSourcesText}
    ${timeConstraintsText}

    ## Task
    Conduct thorough research on the given query and provide a structured analysis and synthesis of the information.

    Constraints:
    - Maximum number of sources to consider: ${config.max_sources}
    - Minimum source reliability: ${config.min_reliability}

    ## Instructions
    1. Gather information from various sources
    2. Analyze the collected information for patterns, gaps, and contradictions
    3. Synthesize findings into coherent insights
    4. Provide key takeaways and a comprehensive summary
    5. Identify limitations and future research directions

    ## Response Format
    Provide your response as a JSON object with the following structure:
    {
      "query": "The original research query",
      "topic_type": "TOPIC_TYPE",
      "objective": "Research objective",
      
      "sources": [
        {
          "id": "unique-id",
          "title": "Source title",
          "url": "Source URL (if applicable)",
          "author": "Author name(s) (if applicable)",
          "publicationDate": "Publication date (if applicable)",
          "type": "SOURCE_TYPE",
          "reliability": "RELIABILITY_RATING",
          "key_points": ["List of key points from this source"]
        }
      ],
      
      "findings": [
        {
          "id": "unique-id",
          "topic": "Sub-topic of the finding",
          "description": "Description of the finding",
          "source_ids": ["IDs of sources supporting this finding"],
          "confidence": 0.85,
          "contradicting_findings": ["IDs of contradicting findings (if any)"]
        }
      ],
      
      "analysis": {
        "patterns": ["Identified patterns in the research"],
        "gaps": ["Identified gaps in the available information"],
        "controversies": ["Identified controversies or disagreements"],
        "consensus": ["Areas of consensus among sources"],
        "emerging_trends": ["Emerging trends identified in the research"]
      },
      
      "key_takeaways": ["List of key takeaways from the research"],
      "summary": "Comprehensive summary of the research findings",
      
      "confidence_score": 0.8,
      "limitations": ["Limitations of this research"],
      "future_research_directions": ["Suggested directions for future research"]
    }
    `;
  }

  /**
   * Creates a fallback research result when the LLM response cannot be parsed
   * @param query The original research query
   * @param error The error that occurred
   * @returns A fallback research result
   */
  private createFallbackResearchResult(query: string, error: Error): ResearchResult {
    return {
      query,
      topic_type: ResearchTopicType.GENERAL,
      objective: `Research information about: ${query}`,
      
      sources: [
        {
          id: 'fallback-source-1',
          title: 'Error occurred during research process',
          type: SourceType.OTHER,
          reliability: ReliabilityRating.UNKNOWN,
          key_points: ['Could not retrieve information due to processing error']
        }
      ],
      
      findings: [
        {
          id: 'fallback-finding-1',
          topic: 'Research process error',
          description: 'An error occurred during the research process',
          source_ids: ['fallback-source-1'],
          confidence: 0
        }
      ],
      
      analysis: {
        patterns: [],
        gaps: ['Complete information could not be collected due to an error'],
        controversies: [],
        consensus: [],
        emerging_trends: []
      },
      
      key_takeaways: ['research could not be completed due to an error'],
      summary: `The research for "${query}" could not be completed due to an error: ${error.message}`,
      
      confidence_score: 0,
      limitations: [
        'Research process failed due to an error',
        'No reliable information could be collected',
        error.message
      ],
      future_research_directions: [
        'Retry the research with a more specific query',
        'Break down the research question into smaller parts'
      ]
    };
  }

  /**
   * Formats a research result into a human-readable markdown format
   * @param result The research result to format
   * @returns Formatted markdown string
   */
  private formatResearchResult(result: ResearchResult): string {
    // Create markdown output
    let markdown = `# Research Report: ${result.query}\n\n`;
    
    // Add research overview
    markdown += `## Research Overview\n\n`;
    markdown += `**Topic Type:** ${result.topic_type}\n\n`;
    markdown += `**Objective:** ${result.objective}\n\n`;
    markdown += `**Overall Confidence:** ${(result.confidence_score * 100).toFixed(0)}%\n\n`;
    
    // Add sources
    if (result.sources.length > 0) {
      markdown += `## Information Sources\n\n`;
      for (const source of result.sources) {
        markdown += `### ${source.title}\n\n`;
        
        if (source.author) {
          markdown += `**Author(s):** ${source.author}\n\n`;
        }
        
        if (source.publicationDate) {
          markdown += `**Published:** ${source.publicationDate}\n\n`;
        }
        
        markdown += `**Type:** ${source.type}\n\n`;
        markdown += `**Reliability:** ${source.reliability}\n\n`;
        
        if (source.url) {
          markdown += `**Link:** [${source.url}](${source.url})\n\n`;
        }
        
        if (source.key_points.length > 0) {
          markdown += `**Key Points:**\n`;
          for (const point of source.key_points) {
            markdown += `- ${point}\n`;
          }
          markdown += '\n';
        }
      }
    }
    
    // Add findings
    if (result.findings.length > 0) {
      markdown += `## Research Findings\n\n`;
      for (const finding of result.findings) {
        markdown += `### ${finding.topic}\n\n`;
        markdown += `${finding.description}\n\n`;
        
        markdown += `**Confidence:** ${(finding.confidence * 100).toFixed(0)}%\n\n`;
        
        markdown += `**Sources:** ${finding.source_ids.map(id => {
          const source = result.sources.find(s => s.id === id);
          return source ? source.title : id;
        }).join(', ')}\n\n`;
        
        if (finding.contradicting_findings && finding.contradicting_findings.length > 0) {
          markdown += `**Contradicting Findings:** ${finding.contradicting_findings.join(', ')}\n\n`;
        }
      }
    }
    
    // Add analysis
    markdown += `## Analysis\n\n`;
    
    if (result.analysis.patterns.length > 0) {
      markdown += `### Patterns\n\n`;
      for (const pattern of result.analysis.patterns) {
        markdown += `- ${pattern}\n`;
      }
      markdown += '\n';
    }
    
    if (result.analysis.gaps.length > 0) {
      markdown += `### Information Gaps\n\n`;
      for (const gap of result.analysis.gaps) {
        markdown += `- ${gap}\n`;
      }
      markdown += '\n';
    }
    
    if (result.analysis.controversies.length > 0) {
      markdown += `### Controversies\n\n`;
      for (const controversy of result.analysis.controversies) {
        markdown += `- ${controversy}\n`;
      }
      markdown += '\n';
    }
    
    if (result.analysis.consensus.length > 0) {
      markdown += `### Consensus Areas\n\n`;
      for (const consensus of result.analysis.consensus) {
        markdown += `- ${consensus}\n`;
      }
      markdown += '\n';
    }
    
    if (result.analysis.emerging_trends.length > 0) {
      markdown += `### Emerging Trends\n\n`;
      for (const trend of result.analysis.emerging_trends) {
        markdown += `- ${trend}\n`;
      }
      markdown += '\n';
    }
    
    // Add key takeaways
    if (result.key_takeaways.length > 0) {
      markdown += `## Key Takeaways\n\n`;
      for (const takeaway of result.key_takeaways) {
        markdown += `- ${takeaway}\n`;
      }
      markdown += '\n';
    }
    
    // Add summary
    markdown += `## Summary\n\n${result.summary}\n\n`;

    // Add limitations and future research
    if (result.limitations.length > 0) {
      markdown += `## Limitations\n\n`;
      for (const limitation of result.limitations) {
        markdown += `- ${limitation}\n`;
      }
      markdown += '\n';
    }

    if (result.future_research_directions.length > 0) {
      markdown += `## Future Research Directions\n\n`;
      for (const direction of result.future_research_directions) {
        markdown += `- ${direction}\n`;
      }
      markdown += '\n';
    }

    return markdown;
  }
}