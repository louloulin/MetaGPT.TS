/**
 * WriteReview Action
 * 
 * This action generates code reviews, classifies review comments, creates review summaries,
 * provides best practice suggestions, and detects code smells.
 */

import { BaseAction } from './base-action';
import type { Message } from '../types/message';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Review severity levels
 */
export enum ReviewSeverity {
  CRITICAL = 'CRITICAL',   // Issues that must be fixed before merging
  MAJOR = 'MAJOR',         // Significant issues that should be addressed
  MINOR = 'MINOR',         // Minor issues that would be good to fix
  NITPICK = 'NITPICK',     // Small stylistic or preference suggestions
  POSITIVE = 'POSITIVE'    // Positive feedback or compliments
}

/**
 * Review category types
 */
export enum ReviewCategory {
  FUNCTIONALITY = 'FUNCTIONALITY',   // Issues related to functionality or behavior
  PERFORMANCE = 'PERFORMANCE',       // Performance-related issues
  SECURITY = 'SECURITY',             // Security concerns or vulnerabilities
  MAINTAINABILITY = 'MAINTAINABILITY', // Code maintainability issues
  READABILITY = 'READABILITY',       // Code readability or clarity
  TESTABILITY = 'TESTABILITY',       // Issues related to testing
  ARCHITECTURE = 'ARCHITECTURE',     // Architectural concerns
  STYLE = 'STYLE',                   // Code style or formatting issues
  DOCUMENTATION = 'DOCUMENTATION',   // Documentation-related feedback
  OTHER = 'OTHER'                    // Other types of feedback
}

/**
 * Structure for a review comment
 */
export interface ReviewComment {
  severity: ReviewSeverity;
  category: ReviewCategory;
  location?: string;  // File path, line number, etc.
  comment: string;
  suggestion?: string;
}

/**
 * Structure for a code review
 */
export interface CodeReview {
  summary: string;
  generalFeedback: string;
  comments: ReviewComment[];
  bestPractices: string[];
  codeSmells: {
    description: string;
    location?: string;
    impact: string;
    recommendation: string;
  }[];
}

/**
 * Action for generating code reviews
 */
export class WriteReview extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'WriteReview',
      description: config.description || 'Generates comprehensive code reviews with classified comments, summaries, best practice suggestions, and code smell detection',
    });
  }

  /**
   * Parses code content or diffs to identify issues and generate a structured review
   * @param code The code content or diff to review
   * @returns A structured code review
   */
  private async analyzeCode(code: string): Promise<CodeReview> {
    // Prompt template for code review
    const prompt = `
    Please review the following code and provide a comprehensive code review:

    CODE TO REVIEW:
    ${code}

    Please structure your response as a JSON object with the following format:
    {
      "summary": "Brief summary of the overall code quality and main findings",
      "generalFeedback": "Overall assessment of the code",
      "comments": [
        {
          "severity": "One of CRITICAL, MAJOR, MINOR, NITPICK, or POSITIVE",
          "category": "One of FUNCTIONALITY, PERFORMANCE, SECURITY, MAINTAINABILITY, READABILITY, TESTABILITY, ARCHITECTURE, STYLE, DOCUMENTATION, or OTHER",
          "location": "File path and/or line numbers if applicable",
          "comment": "The actual review comment",
          "suggestion": "Suggested improvement if applicable"
        }
      ],
      "bestPractices": ["List of best practices that should be applied"],
      "codeSmells": [
        {
          "description": "Description of the code smell",
          "location": "Where the smell is found",
          "impact": "The potential impact of the smell",
          "recommendation": "How to address the smell"
        }
      ]
    }

    Focus on providing actionable feedback and clear suggestions for improvement.
    `;

    // Get LLM response
    const response = await this.ask(prompt);
    
    try {
      // Parse the JSON response
      const review = JSON.parse(response) as CodeReview;
      return review;
    } catch (error) {
      logger.error('Failed to parse LLM response as JSON', error);
      // Fallback with a basic review structure
      return {
        summary: 'Unable to generate structured review from LLM response',
        generalFeedback: response.slice(0, 1000), // Use part of the response as general feedback
        comments: [],
        bestPractices: [],
        codeSmells: []
      };
    }
  }

  /**
   * Runs the WriteReview action
   * @returns The review results
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running WriteReview action`);
      
      // Get the code content from the context
      const code = this.getArg<string>('code');
      
      if (!code) {
        return this.createOutput(
          'No code content provided for review. Please provide the code to review.',
          'failed'
        );
      }

      // Generate the code review
      const review = await this.analyzeCode(code);

      // Format the review for output
      const formattedReview = this.formatReview(review);
      
      return this.createOutput(
        formattedReview,
        'completed',
        formattedReview
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in WriteReview action:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to generate code review: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Formats a code review into a human-readable markdown format
   * @param review The code review to format
   * @returns Formatted markdown string
   */
  private formatReview(review: CodeReview): string {
    // Create markdown output
    let markdown = `# Code Review\n\n`;
    
    // Add summary and general feedback
    markdown += `## Summary\n\n${review.summary}\n\n`;
    markdown += `## General Feedback\n\n${review.generalFeedback}\n\n`;
    
    // Add detailed comments
    if (review.comments.length > 0) {
      markdown += `## Detailed Comments\n\n`;
      
      // Group comments by severity
      const commentsBySeverity = this.groupCommentsBySeverity(review.comments);
      
      // Add each severity group
      for (const severity of Object.values(ReviewSeverity)) {
        const comments = commentsBySeverity[severity] || [];
        if (comments.length > 0) {
          markdown += `### ${severity} Issues\n\n`;
          
          for (const comment of comments) {
            markdown += `- **[${comment.category}]**`;
            if (comment.location) {
              markdown += ` Location: ${comment.location}`;
            }
            markdown += `\n  ${comment.comment}\n`;
            
            if (comment.suggestion) {
              markdown += `  **Suggestion**: ${comment.suggestion}\n`;
            }
            markdown += '\n';
          }
        }
      }
    }
    
    // Add best practices
    if (review.bestPractices.length > 0) {
      markdown += `## Best Practices\n\n`;
      for (const practice of review.bestPractices) {
        markdown += `- ${practice}\n`;
      }
      markdown += '\n';
    }
    
    // Add code smells
    if (review.codeSmells.length > 0) {
      markdown += `## Code Smells\n\n`;
      for (const smell of review.codeSmells) {
        markdown += `### ${smell.description}\n\n`;
        if (smell.location) {
          markdown += `**Location**: ${smell.location}\n\n`;
        }
        markdown += `**Impact**: ${smell.impact}\n\n`;
        markdown += `**Recommendation**: ${smell.recommendation}\n\n`;
      }
    }
    
    return markdown;
  }

  /**
   * Groups review comments by severity
   * @param comments The comments to group
   * @returns Comments grouped by severity
   */
  private groupCommentsBySeverity(comments: ReviewComment[]): Record<ReviewSeverity, ReviewComment[]> {
    const result: Record<ReviewSeverity, ReviewComment[]> = {} as Record<ReviewSeverity, ReviewComment[]>;
    
    for (const comment of comments) {
      if (!result[comment.severity]) {
        result[comment.severity] = [];
      }
      result[comment.severity].push(comment);
    }
    
    return result;
  }
} 