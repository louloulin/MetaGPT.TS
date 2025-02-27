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
    super(config);
  }

  public async run(): Promise<ActionOutput> {
    try {
      // Check if there are any messages
      const messages = this.context?.memory?.get();
      if (!messages || messages.length === 0) {
        return {
          status: 'failed',
          content: 'No messages available for code review'
        };
      }

      // Get code content from messages
      const codeContent = this.extractCodeContent(messages);
      if (!codeContent) {
        return {
          status: 'completed',
          content: this.formatReview({
            summary: 'No code provided for review',
            generalFeedback: 'Please provide code content for a detailed review',
            comments: [],
            bestPractices: ['Ensure code is provided for review'],
            codeSmells: []
          })
        };
      }

      // Analyze code and generate review
      const review = await this.analyzeCode(codeContent);
      const formattedReview = this.formatReview(review);

      return {
        status: 'completed',
        content: formattedReview
      };
    } catch (error) {
      logger.error('Error in WriteReview:', error);
      return {
        status: 'failed',
        content: `Failed to generate code review: ${error}`
      };
    }
  }

  private extractCodeContent(messages: Message[]): string | null {
    // Try to find code content in messages
    for (const message of messages) {
      if (message.content.includes('```')) {
        const matches = message.content.match(/```[\w]*\n([\s\S]*?)```/);
        if (matches && matches[1]) {
          return matches[1].trim();
        }
      }
    }
    return null;
  }

  private async analyzeCode(code: string): Promise<CodeReview> {
    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    const prompt = `Analyze the following code and provide a detailed review:

${code}

Please include:
1. Overall summary
2. General feedback
3. Specific comments with severity and category
4. Best practices suggestions
5. Code smells identification`;

    try {
      const response = await this.llm.chat(prompt);
      const review = JSON.parse(response);

      return {
        summary: review.summary || 'Code review completed',
        generalFeedback: review.generalFeedback || 'The code needs improvement in several areas',
        comments: review.comments || [],
        bestPractices: review.bestPractices || [],
        codeSmells: review.codeSmells || []
      };
    } catch (error) {
      logger.error('Error analyzing code:', error);
      return {
        summary: 'Error during code analysis',
        generalFeedback: 'Unable to complete full code review',
        comments: [],
        bestPractices: ['Review could not be completed due to an error'],
        codeSmells: []
      };
    }
  }

  private formatReview(review: CodeReview): string {
    let output = '# Code Review\n\n';

    // Add summary
    output += '## Summary\n\n';
    output += `${review.summary}\n\n`;

    // Add general feedback
    if (review.generalFeedback) {
      output += '## General Feedback\n\n';
      output += `${review.generalFeedback}\n\n`;
    }

    // Group and add comments by severity
    if (review.comments.length > 0) {
      const groupedComments = this.groupCommentsBySeverity(review.comments);
      
      for (const severity of Object.values(ReviewSeverity)) {
        const comments = groupedComments[severity];
        if (comments && comments.length > 0) {
          output += `## ${severity} Issues\n\n`;
          comments.forEach(comment => {
            output += `### ${comment.category}\n`;
            if (comment.location) {
              output += `**Location**: ${comment.location}\n`;
            }
            output += `**Comment**: ${comment.comment}\n`;
            if (comment.suggestion) {
              output += `**Suggestion**: ${comment.suggestion}\n`;
            }
            output += '\n';
          });
        }
      }
    }

    // Add best practices
    if (review.bestPractices.length > 0) {
      output += '## Best Practices\n\n';
      review.bestPractices.forEach(practice => {
        output += `- ${practice}\n`;
      });
      output += '\n';
    }

    // Add code smells
    if (review.codeSmells.length > 0) {
      output += '## Code Smells\n\n';
      review.codeSmells.forEach(smell => {
        output += `### ${smell.description}\n`;
        if (smell.location) {
          output += `**Location**: ${smell.location}\n`;
        }
        output += `**Impact**: ${smell.impact}\n`;
        output += `**Recommendation**: ${smell.recommendation}\n\n`;
      });
    }

    return output;
  }

  private groupCommentsBySeverity(comments: ReviewComment[]): Record<ReviewSeverity, ReviewComment[]> {
    const grouped: Record<ReviewSeverity, ReviewComment[]> = {} as Record<ReviewSeverity, ReviewComment[]>;
    
    for (const severity of Object.values(ReviewSeverity)) {
      grouped[severity] = comments.filter(comment => comment.severity === severity);
    }
    
    return grouped;
  }
} 