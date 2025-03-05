import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Evaluation score range
 */
export enum EvaluationScore {
  EXCELLENT = 10,
  VERY_GOOD = 8,
  GOOD = 6,
  FAIR = 4,
  POOR = 2,
  UNACCEPTABLE = 0
}

/**
 * Evaluation aspect type
 */
export interface EvaluationAspect {
  name: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  priority: 'high' | 'medium' | 'low';
  impact: string;
  effort: string;
}

/**
 * Design evaluation result interface
 */
export interface DesignEvaluation {
  summary: {
    overallScore: number;
    majorStrengths: string[];
    majorConcerns: string[];
    verdict: string;
  };
  architecturalPrinciples: EvaluationAspect;
  scalability: EvaluationAspect;
  security: EvaluationAspect;
  maintainability: EvaluationAspect;
  requirementsFulfillment: EvaluationAspect;
  technologyChoices: EvaluationAspect;
  risks: {
    high: {
      description: string;
      impact: string;
      mitigation: string;
    }[];
    medium: {
      description: string;
      impact: string;
      mitigation: string;
    }[];
    low: {
      description: string;
      impact: string;
      mitigation: string;
    }[];
  };
  recommendations: {
    immediate: {
      action: string;
      benefit: string;
      effort: string;
    }[];
    shortTerm: {
      action: string;
      benefit: string;
      effort: string;
    }[];
    longTerm: {
      action: string;
      benefit: string;
      effort: string;
    }[];
  };
}

/**
 * Action for evaluating system design
 */
export class EvaluateDesign extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'EvaluateDesign',
      description: config.description || 'Evaluate system design against best practices and requirements'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const design = this.getArg<string>('design');
    if (!design) {
      throw new Error('No design provided for evaluation');
    }

    // Get optional arguments with defaults
    const requirements = this.getArg<string>('requirements') || '';
    const context = this.getArg<string>('context') || '';
    const focus = this.getArg<string[]>('focus') || [];

    // Log evaluation start
    logger.info(`[${this.name}] Starting design evaluation`);
    logger.debug(`[${this.name}] Configuration:`, {
      hasRequirements: !!requirements,
      hasContext: !!context,
      focusAreas: focus
    });

    return `Please evaluate the following system design against best practices and requirements:

Design:
${design}

${requirements ? `Requirements:\n${requirements}\n\n` : ''}
${context ? `Context:\n${context}\n\n` : ''}
${focus.length ? `Focus Areas:\n${focus.join('\n')}\n\n` : ''}

Please provide the evaluation in the following JSON format:

{
  "summary": {
    "overallScore": "Score from 0-100",
    "majorStrengths": ["List of major strengths"],
    "majorConcerns": ["List of major concerns"],
    "verdict": "Overall evaluation verdict"
  },
  "architecturalPrinciples": {
    "name": "Architectural Principles",
    "score": "${Object.values(EvaluationScore).filter(s => typeof s === 'number').join(' | ')}",
    "strengths": ["List of strengths"],
    "weaknesses": ["List of weaknesses"],
    "recommendations": ["List of recommendations"],
    "priority": "high | medium | low",
    "impact": "Impact description",
    "effort": "Required effort"
  },
  "scalability": {
    "name": "Scalability and Performance",
    "score": "${Object.values(EvaluationScore).filter(s => typeof s === 'number').join(' | ')}",
    "strengths": ["List of strengths"],
    "weaknesses": ["List of weaknesses"],
    "recommendations": ["List of recommendations"],
    "priority": "high | medium | low",
    "impact": "Impact description",
    "effort": "Required effort"
  },
  "security": {
    "name": "Security and Reliability",
    "score": "${Object.values(EvaluationScore).filter(s => typeof s === 'number').join(' | ')}",
    "strengths": ["List of strengths"],
    "weaknesses": ["List of weaknesses"],
    "recommendations": ["List of recommendations"],
    "priority": "high | medium | low",
    "impact": "Impact description",
    "effort": "Required effort"
  },
  "maintainability": {
    "name": "Maintainability and Extensibility",
    "score": "${Object.values(EvaluationScore).filter(s => typeof s === 'number').join(' | ')}",
    "strengths": ["List of strengths"],
    "weaknesses": ["List of weaknesses"],
    "recommendations": ["List of recommendations"],
    "priority": "high | medium | low",
    "impact": "Impact description",
    "effort": "Required effort"
  },
  "requirementsFulfillment": {
    "name": "Requirements Fulfillment",
    "score": "${Object.values(EvaluationScore).filter(s => typeof s === 'number').join(' | ')}",
    "strengths": ["List of strengths"],
    "weaknesses": ["List of weaknesses"],
    "recommendations": ["List of recommendations"],
    "priority": "high | medium | low",
    "impact": "Impact description",
    "effort": "Required effort"
  },
  "technologyChoices": {
    "name": "Technology Choices",
    "score": "${Object.values(EvaluationScore).filter(s => typeof s === 'number').join(' | ')}",
    "strengths": ["List of strengths"],
    "weaknesses": ["List of weaknesses"],
    "recommendations": ["List of recommendations"],
    "priority": "high | medium | low",
    "impact": "Impact description",
    "effort": "Required effort"
  },
  "risks": {
    "high": [
      {
        "description": "Risk description",
        "impact": "Risk impact",
        "mitigation": "Mitigation strategy"
      }
    ],
    "medium": [
      {
        "description": "Risk description",
        "impact": "Risk impact",
        "mitigation": "Mitigation strategy"
      }
    ],
    "low": [
      {
        "description": "Risk description",
        "impact": "Risk impact",
        "mitigation": "Mitigation strategy"
      }
    ]
  },
  "recommendations": {
    "immediate": [
      {
        "action": "Recommended action",
        "benefit": "Expected benefit",
        "effort": "Required effort"
      }
    ],
    "shortTerm": [
      {
        "action": "Recommended action",
        "benefit": "Expected benefit",
        "effort": "Required effort"
      }
    ],
    "longTerm": [
      {
        "action": "Recommended action",
        "benefit": "Expected benefit",
        "effort": "Required effort"
      }
    ]
  }
}

Please ensure:
1. Scores are justified with specific examples
2. Recommendations are actionable and prioritized
3. Risks are properly categorized by severity
4. Impact and effort estimations are realistic
5. All aspects are thoroughly evaluated
6. Recommendations consider resource constraints
7. Both technical and business impacts are considered`;
  }

  /**
   * Parse and validate the design evaluation
   * @param response The LLM response
   * @returns Parsed design evaluation
   */
  private parseEvaluation(response: string): DesignEvaluation {
    try {
      const result = JSON.parse(response);
      
      // Validate required sections
      if (!result.summary || !result.architecturalPrinciples || !result.scalability || 
          !result.security || !result.maintainability || !result.requirementsFulfillment || 
          !result.technologyChoices || !result.risks || !result.recommendations) {
        throw new Error('Missing required sections in evaluation');
      }

      // Validate summary
      if (typeof result.summary.overallScore !== 'number' || 
          result.summary.overallScore < 0 || result.summary.overallScore > 100 ||
          !Array.isArray(result.summary.majorStrengths) || 
          !Array.isArray(result.summary.majorConcerns) ||
          !result.summary.verdict) {
        throw new Error('Invalid summary format');
      }

      // Validate aspects
      const aspects = [
        result.architecturalPrinciples,
        result.scalability,
        result.security,
        result.maintainability,
        result.requirementsFulfillment,
        result.technologyChoices
      ];

      aspects.forEach(aspect => {
        if (!this.validateAspect(aspect)) {
          throw new Error(`Invalid aspect format: ${aspect.name}`);
        }
      });

      // Validate risks
      ['high', 'medium', 'low'].forEach(level => {
        if (!Array.isArray(result.risks[level])) {
          throw new Error(`Invalid risks format for level: ${level}`);
        }
        result.risks[level].forEach(risk => {
          if (!risk.description || !risk.impact || !risk.mitigation) {
            throw new Error(`Incomplete risk definition in ${level} level`);
          }
        });
      });

      // Validate recommendations
      ['immediate', 'shortTerm', 'longTerm'].forEach(timeframe => {
        if (!Array.isArray(result.recommendations[timeframe])) {
          throw new Error(`Invalid recommendations format for timeframe: ${timeframe}`);
        }
        result.recommendations[timeframe].forEach(rec => {
          if (!rec.action || !rec.benefit || !rec.effort) {
            throw new Error(`Incomplete recommendation in ${timeframe} timeframe`);
          }
        });
      });

      return result;
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse design evaluation:`, error);
      throw new Error(`Failed to parse design evaluation: ${error}`);
    }
  }

  /**
   * Validate an evaluation aspect
   * @param aspect The aspect to validate
   * @returns Whether the aspect is valid
   */
  private validateAspect(aspect: EvaluationAspect): boolean {
    return !!(
      aspect.name &&
      typeof aspect.score === 'number' &&
      aspect.score >= EvaluationScore.UNACCEPTABLE &&
      aspect.score <= EvaluationScore.EXCELLENT &&
      Array.isArray(aspect.strengths) &&
      Array.isArray(aspect.weaknesses) &&
      Array.isArray(aspect.recommendations) &&
      ['high', 'medium', 'low'].includes(aspect.priority) &&
      aspect.impact &&
      aspect.effort
    );
  }

  /**
   * Get a descriptive label for a score
   * @param score The numeric score
   * @returns The score label
   */
  private getScoreLabel(score: number): string {
    if (score >= EvaluationScore.EXCELLENT) return 'Excellent';
    if (score >= EvaluationScore.VERY_GOOD) return 'Very Good';
    if (score >= EvaluationScore.GOOD) return 'Good';
    if (score >= EvaluationScore.FAIR) return 'Fair';
    if (score >= EvaluationScore.POOR) return 'Poor';
    return 'Unacceptable';
  }

  /**
   * Format an evaluation aspect as markdown
   * @param aspect The aspect to format
   * @returns Formatted markdown string
   */
  private formatAspect(aspect: EvaluationAspect): string {
    return `### ${aspect.name}
**Score:** ${aspect.score}/10 (${this.getScoreLabel(aspect.score)})  
**Priority:** ${aspect.priority.toUpperCase()}

#### Strengths
${aspect.strengths.map(s => `- ${s}`).join('\n')}

#### Weaknesses
${aspect.weaknesses.map(w => `- ${w}`).join('\n')}

#### Recommendations
${aspect.recommendations.map(r => `- ${r}`).join('\n')}

**Impact:** ${aspect.impact}  
**Required Effort:** ${aspect.effort}`;
  }

  /**
   * Format the design evaluation as markdown
   * @param evaluation The design evaluation
   * @returns Formatted markdown string
   */
  private formatEvaluation(evaluation: DesignEvaluation): string {
    return `# Design Evaluation Report

## Executive Summary
**Overall Score:** ${evaluation.summary.overallScore}/100 (${this.getScoreLabel(Math.round(evaluation.summary.overallScore / 10))})

### Major Strengths
${evaluation.summary.majorStrengths.map(s => `- ${s}`).join('\n')}

### Major Concerns
${evaluation.summary.majorConcerns.map(c => `- ${c}`).join('\n')}

### Verdict
${evaluation.summary.verdict}

## Detailed Evaluation

${this.formatAspect(evaluation.architecturalPrinciples)}

${this.formatAspect(evaluation.scalability)}

${this.formatAspect(evaluation.security)}

${this.formatAspect(evaluation.maintainability)}

${this.formatAspect(evaluation.requirementsFulfillment)}

${this.formatAspect(evaluation.technologyChoices)}

## Risk Analysis

### High-Risk Items
${evaluation.risks.high.map(risk => `
#### ${risk.description}
- **Impact:** ${risk.impact}
- **Mitigation:** ${risk.mitigation}`).join('\n')}

### Medium-Risk Items
${evaluation.risks.medium.map(risk => `
#### ${risk.description}
- **Impact:** ${risk.impact}
- **Mitigation:** ${risk.mitigation}`).join('\n')}

### Low-Risk Items
${evaluation.risks.low.map(risk => `
#### ${risk.description}
- **Impact:** ${risk.impact}
- **Mitigation:** ${risk.mitigation}`).join('\n')}

## Recommendations

### Immediate Actions
${evaluation.recommendations.immediate.map(rec => `
#### ${rec.action}
- **Benefit:** ${rec.benefit}
- **Effort:** ${rec.effort}`).join('\n')}

### Short-term Improvements
${evaluation.recommendations.shortTerm.map(rec => `
#### ${rec.action}
- **Benefit:** ${rec.benefit}
- **Effort:** ${rec.effort}`).join('\n')}

### Long-term Considerations
${evaluation.recommendations.longTerm.map(rec => `
#### ${rec.action}
- **Benefit:** ${rec.benefit}
- **Effort:** ${rec.effort}`).join('\n')}

## Evaluation Checklist
- [x] All aspects thoroughly evaluated
- [x] Scores justified with examples
- [x] Risks properly categorized
- [x] Recommendations prioritized
- [x] Impact and effort estimated
- [x] Technical aspects covered
- [x] Business impacts considered
- [x] Resource constraints considered`;
  }

  /**
   * Execute the design evaluation action
   * @returns Evaluation results with detailed breakdown
   */
  public async run(): Promise<ActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Generate evaluation using LLM
      const response = await this.ask(prompt);
      
      // Parse and validate evaluation
      const result = this.parseEvaluation(response);
      
      // Format as markdown
      const formattedResult = this.formatEvaluation(result);
      
      return this.createOutput(
        formattedResult,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in design evaluation:`, error);
      return this.createOutput(
        `Failed to evaluate design: ${error}`,
        'failed'
      );
    }
  }
} 