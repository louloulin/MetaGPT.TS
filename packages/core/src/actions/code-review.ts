import { BaseAction } from './base-action';
import type { ActionConfig, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';
import { ProgrammingLanguage } from './write-code';

/**
 * Review severity levels
 */
export enum ReviewSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Review category types
 */
export enum ReviewCategory {
  CODE_QUALITY = 'code_quality',
  BEST_PRACTICES = 'best_practices',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  MAINTAINABILITY = 'maintainability',
  READABILITY = 'readability',
  TYPE_SAFETY = 'type_safety',
  ERROR_HANDLING = 'error_handling',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation'
}

/**
 * Code review issue interface
 */
export interface ReviewIssue {
  description: string;
  category: ReviewCategory;
  severity: ReviewSeverity;
  lineNumbers?: number[];
  suggestion: string;
  example?: string;
  impact: string;
  effort: string;
}

/**
 * Code review result interface
 */
export interface CodeReviewResult {
  summary: {
    totalIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
    score: number;
  };
  issues: ReviewIssue[];
  positiveNotes: string[];
  metrics: {
    complexity: number;
    maintainability: number;
    testability: number;
    reusability: number;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

/**
 * Action for performing code review
 */
export class CodeReviewAction extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'CodeReview',
      description: config.description || 'Review code and provide comprehensive improvement suggestions'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const code = this.getArg<string>('code');
    if (!code) {
      throw new Error('No code provided for review');
    }

    // Get optional arguments with defaults
    const language = this.getArg<string>('language') || ProgrammingLanguage.TYPESCRIPT;
    const focus = this.getArg<ReviewCategory[]>('focus') || [
      ReviewCategory.CODE_QUALITY,
      ReviewCategory.BEST_PRACTICES,
      ReviewCategory.PERFORMANCE,
      ReviewCategory.SECURITY,
      ReviewCategory.MAINTAINABILITY
    ];

    // Log review start
    logger.info(`[${this.name}] Starting code review for ${language}`);
    logger.debug(`[${this.name}] Focus areas:`, focus);

    return `Please review the following ${language} code and provide a comprehensive analysis:

\`\`\`${language}
${code}
\`\`\`

Please provide the review in the following JSON format:

{
  "summary": {
    "totalIssues": 0,
    "criticalCount": 0,
    "highCount": 0,
    "mediumCount": 0,
    "lowCount": 0,
    "infoCount": 0,
    "score": 0
  },
  "issues": [
    {
      "description": "Issue description",
      "category": "${Object.values(ReviewCategory).join('" | "')}",
      "severity": "${Object.values(ReviewSeverity).join('" | "')}",
      "lineNumbers": [0],
      "suggestion": "How to fix the issue",
      "example": "Example of fixed code",
      "impact": "Impact of the issue",
      "effort": "Effort required to fix"
    }
  ],
  "positiveNotes": [
    "List of positive aspects"
  ],
  "metrics": {
    "complexity": 0,
    "maintainability": 0,
    "testability": 0,
    "reusability": 0
  },
  "recommendations": {
    "immediate": [
      "List of immediate actions"
    ],
    "shortTerm": [
      "List of short-term improvements"
    ],
    "longTerm": [
      "List of long-term improvements"
    ]
  }
}

Focus on these aspects:
${focus.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Please ensure:
1. All metrics are scored from 0-10
2. The overall score is from 0-100
3. Issues are properly categorized and prioritized
4. Line numbers are provided when possible
5. Suggestions are specific and actionable
6. Examples are provided for complex changes
7. Both issues and positive aspects are noted
8. Recommendations are practical and prioritized`;
  }

  /**
   * Parse and validate the review response
   * @param response The LLM response
   * @returns Parsed review result
   */
  private parseReviewResponse(response: string): CodeReviewResult {
    try {
      const result = JSON.parse(response);
      
      // Validate required fields
      if (!result.summary || !result.issues || !result.metrics || !result.recommendations) {
        throw new Error('Missing required fields in review response');
      }

      // Validate score range
      if (result.summary.score < 0 || result.summary.score > 100) {
        throw new Error('Overall score must be between 0 and 100');
      }

      // Validate metric ranges
      Object.entries(result.metrics).forEach(([metric, value]) => {
        const numericValue = value as number;
        if (numericValue < 0 || numericValue > 10) {
          throw new Error(`${metric} score must be between 0 and 10`);
        }
      });

      return result;
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse review response:`, error);
      throw new Error(`Failed to parse code review: ${error}`);
    }
  }

  /**
   * Format the review result as markdown
   * @param result The code review result
   * @returns Formatted markdown string
   */
  private formatReviewResult(result: CodeReviewResult): string {
    const language = this.getArg<string>('language') || ProgrammingLanguage.TYPESCRIPT;

    return `# Code Review Report

## Summary
- Total Issues: ${result.summary.totalIssues}
- Critical: ${result.summary.criticalCount}
- High: ${result.summary.highCount}
- Medium: ${result.summary.mediumCount}
- Low: ${result.summary.lowCount}
- Info: ${result.summary.infoCount}
- Overall Score: ${result.summary.score}/100

## Issues
${result.issues.map(issue => `
### ${issue.category} (${issue.severity})
${issue.lineNumbers?.length ? `**Lines**: ${issue.lineNumbers.join(', ')}\n` : ''}
**Description**: ${issue.description}

**Impact**: ${issue.impact}

**Suggestion**: ${issue.suggestion}
${issue.example ? `
**Example**:
\`\`\`${language}
${issue.example}
\`\`\`
` : ''}
**Effort**: ${issue.effort}
`).join('\n')}

## Positive Aspects
${result.positiveNotes.map(note => `- ${note}`).join('\n')}

## Code Metrics
- Complexity: ${result.metrics.complexity}/10
- Maintainability: ${result.metrics.maintainability}/10
- Testability: ${result.metrics.testability}/10
- Reusability: ${result.metrics.reusability}/10

## Recommendations

### Immediate Actions
${result.recommendations.immediate.map(rec => `- ${rec}`).join('\n')}

### Short-term Improvements
${result.recommendations.shortTerm.map(rec => `- ${rec}`).join('\n')}

### Long-term Improvements
${result.recommendations.longTerm.map(rec => `- ${rec}`).join('\n')}

## Quality Checklist
- [x] Code quality assessed
- [x] Best practices reviewed
- [x] Performance analyzed
- [x] Security evaluated
- [x] Maintainability measured
- [x] Actionable feedback provided
- [x] Examples included where needed
- [x] Priorities assigned to issues`;
  }

  /**
   * Execute the code review action
   * @returns Review results with detailed analysis
   */
  public async run(): Promise<ActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Generate review using LLM
      const response = await this.ask(prompt);
      
      // Parse and validate review
      const result = this.parseReviewResponse(response);
      
      // Format as markdown
      const formattedResult = this.formatReviewResult(result);
      
      return this.createOutput(
        formattedResult,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in code review:`, error);
      return this.createOutput(
        `Failed to review code: ${error}`,
        'failed'
      );
    }
  }
}