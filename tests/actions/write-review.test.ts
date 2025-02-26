/**
 * Unit tests for WriteReview action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteReview, ReviewSeverity, ReviewCategory } from '../../src/actions/write-review';

// Mock LLM provider
const mockLLM = {
  chat: vi.fn(),
  getName: () => 'MockLLM',
  getModel: () => 'test-model',
  generate: vi.fn(),
};

describe('WriteReview', () => {
  let writeReview: WriteReview;

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create WriteReview instance with mock LLM
    writeReview = new WriteReview({
      name: 'WriteReview',
      llm: mockLLM,
      args: {
        code: 'function test() { console.log("Hello"); }',
      },
    });
  });

  it('should create a WriteReview instance', () => {
    expect(writeReview).toBeInstanceOf(WriteReview);
  });

  it('should generate a code review when provided with code', async () => {
    // Mock LLM response as a valid JSON review
    const mockReview = {
      summary: 'Simple function with no issues',
      generalFeedback: 'The code is simple and works as expected',
      comments: [
        {
          severity: ReviewSeverity.MINOR,
          category: ReviewCategory.STYLE,
          location: 'line 1',
          comment: 'Consider using const instead of function declaration',
          suggestion: 'const test = () => { console.log("Hello"); };',
        },
      ],
      bestPractices: ['Use consistent code style'],
      codeSmells: [],
    };

    // Setup mock to return JSON string of the mock review
    mockLLM.chat.mockResolvedValue(JSON.stringify(mockReview));

    // Run the action
    const result = await writeReview.run();

    // Check that the result contains expected elements
    expect(result.content).toContain('# Code Review');
    expect(result.content).toContain('## Summary');
    expect(result.content).toContain(mockReview.summary);
    expect(result.content).toContain('## Detailed Comments');
    expect(result.content).toContain('MINOR Issues');
    expect(result.content).toContain('## Best Practices');
    expect(result.status).toBe('completed');
  });

  it('should handle LLM response that is not valid JSON', async () => {
    // Mock LLM response that is not valid JSON
    mockLLM.chat.mockResolvedValue('This is not a valid JSON response');

    // Run the action
    const result = await writeReview.run();

    // Check that the action handles the invalid response gracefully
    expect(result.content).toContain('# Code Review');
    expect(result.content).toContain('Unable to generate structured review from LLM response');
    expect(result.status).toBe('completed');
  });

  it('should return an error when no code is provided', async () => {
    // Create WriteReview instance with no code
    const emptyReview = new WriteReview({
      name: 'WriteReview',
      llm: mockLLM,
      args: {}, // No code provided
    });

    // Run the action
    const result = await emptyReview.run();

    // Check that an error is returned
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No code content provided for review');
  });

  it('should correctly group comments by severity', async () => {
    // Mock LLM response with comments of different severities
    const mockReview = {
      summary: 'Code review with multiple comment severities',
      generalFeedback: 'Overall good, with some issues',
      comments: [
        {
          severity: ReviewSeverity.CRITICAL,
          category: ReviewCategory.SECURITY,
          comment: 'Security vulnerability found',
        },
        {
          severity: ReviewSeverity.MAJOR,
          category: ReviewCategory.PERFORMANCE,
          comment: 'Performance issue detected',
        },
        {
          severity: ReviewSeverity.MINOR,
          category: ReviewCategory.STYLE,
          comment: 'Style issue',
        },
        {
          severity: ReviewSeverity.MINOR,
          category: ReviewCategory.DOCUMENTATION,
          comment: 'Missing documentation',
        },
        {
          severity: ReviewSeverity.POSITIVE,
          category: ReviewCategory.READABILITY,
          comment: 'Good variable naming',
        },
      ],
      bestPractices: [],
      codeSmells: [],
    };

    // Setup mock to return JSON string of the mock review
    mockLLM.chat.mockResolvedValue(JSON.stringify(mockReview));

    // Run the action
    const result = await writeReview.run();

    // Check that comments are grouped by severity
    expect(result.content).toContain('### CRITICAL Issues');
    expect(result.content).toContain('### MAJOR Issues');
    expect(result.content).toContain('### MINOR Issues');
    expect(result.content).toContain('### POSITIVE Issues');
    expect(result.content).toContain('[SECURITY]');
    expect(result.content).toContain('[PERFORMANCE]');
    expect(result.content).toContain('[STYLE]');
    expect(result.content).toContain('[DOCUMENTATION]');
    expect(result.content).toContain('[READABILITY]');
  });

  it('should include code smells section when provided', async () => {
    // Mock LLM response with code smells
    const mockReview = {
      summary: 'Code with smells',
      generalFeedback: 'Several code smells detected',
      comments: [],
      bestPractices: [],
      codeSmells: [
        {
          description: 'Duplicate code',
          location: 'lines 10-20',
          impact: 'Makes code harder to maintain',
          recommendation: 'Extract to a reusable function',
        },
      ],
    };

    // Setup mock to return JSON string of the mock review
    mockLLM.chat.mockResolvedValue(JSON.stringify(mockReview));

    // Run the action
    const result = await writeReview.run();

    // Check that code smells section is included
    expect(result.content).toContain('## Code Smells');
    expect(result.content).toContain('### Duplicate code');
    expect(result.content).toContain('**Location**: lines 10-20');
    expect(result.content).toContain('**Impact**: Makes code harder to maintain');
    expect(result.content).toContain('**Recommendation**: Extract to a reusable function');
  });
}); 