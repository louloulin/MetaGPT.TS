/**
 * @module RecommendationEngine
 * @category Tools
 * 
 * Recommendation engine for data analysis insights and recommendations
 */

import { BaseTool } from '../base-tool';
import type { ToolConfig, ToolResult } from '../../types/tool';
import { logger } from '../../utils/logger';
import type { LLMProvider } from '../../types/llm';

// Supported recommendation types
export type RecommendationType =
  | 'insights'      // Key insights from data
  | 'actions'       // Recommended actions
  | 'trends'        // Trend analysis
  | 'correlations'  // Important correlations
  | 'anomalies'     // Detected anomalies
  | 'predictions'   // Future predictions
  | 'improvements'; // Improvement suggestions

// Recommendation configuration
export interface RecommendationConfig {
  type: RecommendationType;
  data: any[];
  context?: {
    objective?: string;    // Analysis objective
    timeframe?: string;    // Time period to consider
    metrics?: string[];    // Important metrics
    constraints?: any;     // Business constraints
    previousResults?: any; // Previous analysis results
  };
  options?: {
    maxRecommendations?: number;  // Maximum number of recommendations
    minConfidence?: number;       // Minimum confidence threshold
    priorityMetrics?: string[];   // High-priority metrics
    excludeMetrics?: string[];    // Metrics to exclude
  };
}

/**
 * Recommendation Engine Tool
 * Generates insights and recommendations from data analysis
 */
export class RecommendationEngine extends BaseTool {
  private llm: LLMProvider;

  constructor(config: ToolConfig & { llm: LLMProvider }) {
    super({
      name: 'recommendation_engine',
      description: 'Generate insights and recommendations from data analysis',
      version: '1.0.0',
      category: 'data_analysis',
      ...config,
    });

    this.llm = config.llm;
  }

  /**
   * Execute recommendation generation
   * @param args Execution parameters
   * @returns Recommendations and insights
   */
  async execute(args?: Record<string, any>): Promise<ToolResult> {
    try {
      // Validate input parameters
      if (!args?.data || !Array.isArray(args.data)) {
        return this.createResult(false, 'Data array is required');
      }

      if (!args?.type) {
        return this.createResult(false, 'Recommendation type is required');
      }

      const config: RecommendationConfig = {
        type: args.type,
        data: args.data,
        context: args.context,
        options: args.options
      };

      // Generate recommendations
      const recommendations = await this.generateRecommendations(config);
      
      return this.createResult(
        true,
        'Recommendations generated successfully',
        recommendations
      );
    } catch (error) {
      logger.error(`[RecommendationEngine] Error: ${(error as Error).message}`);
      return this.createResult(
        false,
        `Recommendation generation failed: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Generate recommendations based on configuration
   */
  private async generateRecommendations(config: RecommendationConfig): Promise<any> {
    // Prepare data summary for LLM
    const dataSummary = this.summarizeData(config.data);
    
    // Create prompt for LLM
    const prompt = `Based on the following data analysis, please provide ${config.type} recommendations:

Data Summary:
${JSON.stringify(dataSummary, null, 2)}

${config.context ? `Context:
${JSON.stringify(config.context, null, 2)}` : ''}

Please provide your recommendations in the following JSON format:
{
  "recommendations": [
    {
      "title": "recommendation title",
      "description": "detailed description",
      "impact": "potential impact",
      "confidence": 0.0-1.0,
      "actionItems": ["specific actions to take"],
      "metrics": ["affected metrics"],
      "priority": "high/medium/low"
    }
  ],
  "summary": "overall summary of recommendations",
  "nextSteps": ["suggested next steps"]
}`;

    try {
      // Get LLM response
      const response = await this.llm.generate(prompt);
      const result = JSON.parse(response);

      // Filter and sort recommendations
      result.recommendations = this.filterRecommendations(
        result.recommendations,
        config.options
      );

      return {
        type: config.type,
        ...result
      };
    } catch (error) {
      throw new Error(`Failed to generate recommendations: ${(error as Error).message}`);
    }
  }

  /**
   * Summarize data for LLM input
   */
  private summarizeData(data: any[]): any {
    const summary: any = {
      recordCount: data.length,
      fields: {},
      metrics: {}
    };

    if (data.length === 0) return summary;

    // Analyze fields
    const sampleRow = data[0];
    Object.keys(sampleRow).forEach(field => {
      const values = data.map(row => row[field]);
      const fieldType = typeof values[0];

      if (fieldType === 'number') {
        summary.metrics[field] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length
        };
      } else {
        const uniqueValues = new Set(values);
        summary.fields[field] = {
          type: fieldType,
          uniqueValues: uniqueValues.size,
          sample: Array.from(uniqueValues).slice(0, 5)
        };
      }
    });

    return summary;
  }

  /**
   * Filter and sort recommendations based on options
   */
  private filterRecommendations(recommendations: any[], options?: RecommendationConfig['options']): any[] {
    if (!recommendations) return [];

    let filtered = [...recommendations];

    // Apply confidence threshold
    if (options?.minConfidence) {
      filtered = filtered.filter(r => r.confidence >= options.minConfidence);
    }

    // Filter by priority metrics
    if (options?.priorityMetrics) {
      filtered = filtered.filter(r =>
        r.metrics?.some((m: string) => options.priorityMetrics?.includes(m))
      );
    }

    // Exclude metrics
    if (options?.excludeMetrics) {
      filtered = filtered.filter(r =>
        !r.metrics?.some((m: string) => options.excludeMetrics?.includes(m))
      );
    }

    // Sort by confidence and priority
    filtered.sort((a, b) => {
      const priorityScore = { high: 3, medium: 2, low: 1 };
      const aScore = (a.confidence || 0) * priorityScore[a.priority || 'low'];
      const bScore = (b.confidence || 0) * priorityScore[b.priority || 'low'];
      return bScore - aScore;
    });

    // Limit number of recommendations
    if (options?.maxRecommendations) {
      filtered = filtered.slice(0, options.maxRecommendations);
    }

    return filtered;
  }

  /**
   * Get help information
   */
  getHelp(): string {
    return `
Tool: ${this.name} (v${this.version})
Category: ${this.category}
Description: ${this.description}

Supported Recommendation Types:
- insights: Key insights from data analysis
- actions: Recommended actions to take
- trends: Trend analysis and patterns
- correlations: Important correlations between metrics
- anomalies: Detected anomalies and outliers
- predictions: Future predictions and forecasts
- improvements: Suggestions for improvement

Arguments:
- type: Recommendation type (required)
- data: Array of data objects (required)
- context: Additional context (optional)
  - objective: Analysis objective
  - timeframe: Time period to consider
  - metrics: Important metrics
  - constraints: Business constraints
  - previousResults: Previous analysis results
- options: Configuration options (optional)
  - maxRecommendations: Maximum number of recommendations
  - minConfidence: Minimum confidence threshold
  - priorityMetrics: High-priority metrics
  - excludeMetrics: Metrics to exclude

Example Usage:
{
  type: 'insights',
  data: [...],
  context: {
    objective: 'Improve sales performance',
    metrics: ['revenue', 'conversion_rate']
  },
  options: {
    maxRecommendations: 5,
    minConfidence: 0.8
  }
}
    `.trim();
  }
} 