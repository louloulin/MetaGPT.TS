/**
 * Unit tests for WriteReview action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteReview, ReviewSeverity, ReviewCategory } from '../../src/actions/write-review';
import { UserMessage } from '../../src/types/message';
import { ContextImpl, ContextFactory, GlobalContext } from '../../src/context/context';
import { MemoryManagerImpl } from '../../src/memory/manager';
import { ArrayMemory } from '../../src/memory/array';
import { createLLMProvider } from '../mocks/llm-provider';
describe('WriteReview', () => {
  let writeReview: WriteReview;

  beforeEach(async () => {
    // Initialize global context
    GlobalContext.reset();
    
    // Create a new ArrayMemory instance
    const memory = new ArrayMemory();
    
    // Create LLM provider with system prompt for code review
    const systemPrompt = "You are a code review expert. Provide detailed, constructive feedback on code.";
    const llmProvider = createLLMProvider(systemPrompt);
    
    // Create WriteReview instance with memory and LLM
    writeReview = new WriteReview({
      name: 'code-review',
      description: 'Reviews code and provides feedback',
      memory,
      llm: llmProvider
    });
  });

  it('should create a WriteReview instance', () => {
    expect(writeReview).toBeInstanceOf(WriteReview);
    expect(writeReview.name).toBe('code-review');
  });

  it('should handle empty message list', async () => {
    // Ensure memory is empty - it should be empty by default
    
    const result = await writeReview.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages available');
  });

  it('should generate code review successfully', async () => {
    // Add a message to the action's memory
    writeReview.context.memory.add(new UserMessage('Review this codebase and provide feedback'));

    // Run review generation
    const result = await writeReview.run();

    // Verify result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Code Review');
    expect(result.content).toContain('## Summary');
    expect(result.content).toContain('The code needs improvement in several areas');
    expect(result.content).toContain('## Critical Issues');
    expect(result.content).toContain('Password is being stored in plain text');
    expect(result.content).toContain('## Major Issues');
    expect(result.content).toContain('Inefficient data fetching approach');
    expect(result.content).toContain('## Best Practices');
    expect(result.content).toContain('Use TypeScript interfaces for complex data structures');
    expect(result.content).toContain('## Code Smells');
    expect(result.content).toContain('Duplicate code in multiple components');
  });

  it('should handle LLM response parsing error', async () => {
    // Add a message to the action's memory
    writeReview.context.memory.add(new UserMessage('Review this code with Invalid JSON'));

    // Run review generation
    const result = await writeReview.run();

    // Verify fallback behavior
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Code Review');
    expect(result.content).toContain('Unable to generate a complete code review');
    expect(result.content).toContain('Basic feedback');
  });

  it('should handle missing fields in LLM response', async () => {
    // Add a message to the action's memory
    writeReview.context.memory.add(new UserMessage('Review this code with Partial review'));

    // Run review generation
    const result = await writeReview.run();

    // Verify default values are used
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Partial code review');
    expect(result.content).toContain('Limited feedback available');
    expect(result.content).toContain('No specific issues found');
  });

  it('should group comments by severity correctly', async () => {
    // Add a message to the action's memory
    writeReview.context.memory.add(new UserMessage('Review code with various severities'));

    // Run review generation
    const result = await writeReview.run();

    // Verify severity grouping
    expect(result.status).toBe('completed');
    expect(result.content).toContain('## Critical Issues');
    expect(result.content).toContain('Critical security issue');
    expect(result.content).toContain('Critical performance issue');
    expect(result.content).toContain('## Major Issues');
    expect(result.content).toContain('Major functionality issue');
    expect(result.content).toContain('## Minor Suggestions');
    expect(result.content).toContain('Minor style issue');
    expect(result.content).toContain('## Positive Feedback');
    expect(result.content).toContain('Good readability');
  });
});

// Helper functions to provide consistent mock data
function getMockSuccessfulReview() {
  return {
    summary: 'The code needs improvement in several areas',
    generalFeedback: 'The code is functional but has room for improvement in terms of organization and performance',
    comments: [
      {
        severity: ReviewSeverity.CRITICAL,
        category: ReviewCategory.SECURITY,
        location: 'src/auth/login.ts:45',
        comment: 'Password is being stored in plain text',
        suggestion: 'Use bcrypt to hash passwords before storing'
      },
      {
        severity: ReviewSeverity.MAJOR,
        category: ReviewCategory.PERFORMANCE,
        location: 'src/data/fetch.ts:23',
        comment: 'Inefficient data fetching approach',
        suggestion: 'Implement pagination and limit query results'
      },
      {
        severity: ReviewSeverity.MINOR,
        category: ReviewCategory.READABILITY,
        location: 'src/components/User.tsx:12',
        comment: 'Variable names are not descriptive',
        suggestion: 'Use more meaningful variable names to improve readability'
      },
      {
        severity: ReviewSeverity.POSITIVE,
        category: ReviewCategory.ARCHITECTURE,
        location: 'src/utils/helpers.ts',
        comment: 'Well-organized utility functions with good separation of concerns',
        suggestion: 'Consider adding JSDoc comments to improve documentation'
      }
    ],
    bestPractices: [
      'Use TypeScript interfaces for complex data structures',
      'Implement proper error handling',
      'Write unit tests for critical functionality'
    ],
    codeSmells: [
      {
        description: 'Duplicate code in multiple components',
        location: 'src/components/Profile.tsx, src/components/Settings.tsx',
        impact: 'Increases maintenance burden and risk of inconsistent updates',
        recommendation: 'Extract common functionality into shared utility functions'
      },
      {
        description: 'Large function with multiple responsibilities',
        location: 'src/services/dataProcessor.ts:78',
        impact: 'Reduces code readability and testability',
        recommendation: 'Break down into smaller, focused functions'
      }
    ]
  };
}

function getMockSeverityGroupedReview() {
  return {
    summary: 'Mixed severity issues',
    generalFeedback: 'Various issues of different priorities',
    comments: [
      {
        severity: ReviewSeverity.CRITICAL,
        category: ReviewCategory.SECURITY,
        comment: 'Critical security issue'
      },
      {
        severity: ReviewSeverity.CRITICAL,
        category: ReviewCategory.PERFORMANCE,
        comment: 'Critical performance issue'
      },
      {
        severity: ReviewSeverity.MAJOR,
        category: ReviewCategory.FUNCTIONALITY,
        comment: 'Major functionality issue'
      },
      {
        severity: ReviewSeverity.MINOR,
        category: ReviewCategory.STYLE,
        comment: 'Minor style issue'
      },
      {
        severity: ReviewSeverity.POSITIVE,
        category: ReviewCategory.READABILITY,
        comment: 'Good readability'
      }
    ],
    bestPractices: ['Best practice 1'],
    codeSmells: []
  };
} 