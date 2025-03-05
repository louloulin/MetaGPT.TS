import { BaseAction } from './base-action';
import type { ActionConfig, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Quality attributes for architecture evaluation
 */
export enum ArchitectureQualityAttribute {
  SCALABILITY = 'scalability',
  MAINTAINABILITY = 'maintainability',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  RELIABILITY = 'reliability',
  FLEXIBILITY = 'flexibility',
  TESTABILITY = 'testability',
  USABILITY = 'usability'
}

/**
 * Architecture evaluation result interface
 */
export interface ArchitectureEvaluation {
  analysis: {
    components: string[];
    dataFlow: string;
    integrationPoints: string[];
    techStack: string[];
  };
  qualityAssessment: Record<ArchitectureQualityAttribute, {
    score: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  risks: {
    technical: string[];
    implementation: string[];
    operational: string[];
    security: string[];
  };
  recommendations: {
    immediate: string[];
    longTerm: string[];
    alternatives: string[];
    bestPractices: string[];
  };
}

/**
 * Action for evaluating software architecture
 */
export class EvaluateArchitectureAction extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'EvaluateArchitecture',
      description: config.description || 'Evaluate software architecture and provide recommendations'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const architecture = this.getArg<string>('architecture');
    if (!architecture) {
      throw new Error('No architecture description provided for evaluation');
    }

    // Get optional arguments with defaults
    const context = this.getArg<string>('context') || '';
    const requirements = this.getArg<string[]>('requirements') || [];
    const focus = this.getArg<ArchitectureQualityAttribute[]>('focus') || [
      ArchitectureQualityAttribute.SCALABILITY,
      ArchitectureQualityAttribute.MAINTAINABILITY,
      ArchitectureQualityAttribute.SECURITY,
      ArchitectureQualityAttribute.PERFORMANCE,
      ArchitectureQualityAttribute.RELIABILITY
    ];

    // Log evaluation start
    logger.info(`[${this.name}] Starting architecture evaluation with focus on: ${focus.join(', ')}`);

    return `Please evaluate the following software architecture:

${context ? `Context:\n${context}\n\n` : ''}
Architecture Description:
${architecture}

${requirements.length > 0 ? `Requirements:\n${requirements.join('\n')}\n\n` : ''}

Please provide a comprehensive evaluation focusing on:
${focus.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Evaluate and provide a detailed analysis in the following JSON format:

{
  "analysis": {
    "components": ["List of main components"],
    "dataFlow": "Description of data flow between components",
    "integrationPoints": ["List of integration points"],
    "techStack": ["List of technologies used"]
  },
  "qualityAssessment": {
    ${focus.map(attr => `"${attr}": {
      "score": "Score from 1-10",
      "strengths": ["List of strengths"],
      "weaknesses": ["List of weaknesses"]
    }`).join(',\n    ')}
  },
  "risks": {
    "technical": ["List of technical risks"],
    "implementation": ["List of implementation challenges"],
    "operational": ["List of operational concerns"],
    "security": ["List of security vulnerabilities"]
  },
  "recommendations": {
    "immediate": ["List of immediate improvements"],
    "longTerm": ["List of long-term enhancements"],
    "alternatives": ["List of alternative approaches"],
    "bestPractices": ["List of recommended best practices"]
  }
}

Please ensure:
1. All scores are between 1-10
2. Each list contains at least 2-3 items
3. Recommendations are specific and actionable
4. Technical terms are explained when first used
5. Security concerns are thoroughly addressed`;
  }

  /**
   * Parse and validate the evaluation response
   * @param response The LLM response
   * @returns Parsed architecture evaluation
   */
  private parseEvaluation(response: string): ArchitectureEvaluation {
    try {
      const evaluation = JSON.parse(response) as ArchitectureEvaluation;
      
      // Validate scores
      Object.values(evaluation.qualityAssessment).forEach(assessment => {
        if (assessment.score < 1 || assessment.score > 10) {
          throw new Error('Quality assessment scores must be between 1 and 10');
        }
      });

      return evaluation;
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse evaluation response:`, error);
      throw new Error(`Failed to parse architecture evaluation: ${error}`);
    }
  }

  /**
   * Format the evaluation as markdown
   * @param evaluation The architecture evaluation
   * @returns Formatted markdown string
   */
  private formatEvaluation(evaluation: ArchitectureEvaluation): string {
    return `# Architecture Evaluation Report

## Component Analysis
${evaluation.analysis.components.map(c => `- ${c}`).join('\n')}

## Data Flow
${evaluation.analysis.dataFlow}

## Integration Points
${evaluation.analysis.integrationPoints.map(p => `- ${p}`).join('\n')}

## Technology Stack
${evaluation.analysis.techStack.map(t => `- ${t}`).join('\n')}

## Quality Assessment
${Object.entries(evaluation.qualityAssessment).map(([attr, assessment]) => `
### ${attr.charAt(0).toUpperCase() + attr.slice(1)} (Score: ${assessment.score}/10)
Strengths:
${assessment.strengths.map(s => `- ${s}`).join('\n')}

Weaknesses:
${assessment.weaknesses.map(w => `- ${w}`).join('\n')}
`).join('\n')}

## Risks

### Technical Risks
${evaluation.risks.technical.map(r => `- ${r}`).join('\n')}

### Implementation Challenges
${evaluation.risks.implementation.map(c => `- ${c}`).join('\n')}

### Operational Concerns
${evaluation.risks.operational.map(c => `- ${c}`).join('\n')}

### Security Vulnerabilities
${evaluation.risks.security.map(v => `- ${v}`).join('\n')}

## Recommendations

### Immediate Actions
${evaluation.recommendations.immediate.map(r => `- ${r}`).join('\n')}

### Long-term Improvements
${evaluation.recommendations.longTerm.map(r => `- ${r}`).join('\n')}

### Alternative Approaches
${evaluation.recommendations.alternatives.map(a => `- ${a}`).join('\n')}

### Best Practices
${evaluation.recommendations.bestPractices.map(p => `- ${p}`).join('\n')}`;
  }

  /**
   * Run the architecture evaluation
   */
  public async run(): Promise<ActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Get LLM response
      const response = await this.ask(prompt);
      
      // Parse and validate evaluation
      const evaluation = this.parseEvaluation(response);
      
      // Format as markdown
      const formattedEvaluation = this.formatEvaluation(evaluation);
      
      return this.createOutput(
        formattedEvaluation,
        'completed',
        evaluation
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in architecture evaluation:`, error);
      return this.createOutput(
        `Failed to evaluate architecture: ${error}`,
        'failed'
      );
    }
  }
} 