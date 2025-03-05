/**
 * Unit tests for Searcher role
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Searcher } from '../../src/roles/searcher';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import type { LLMProvider } from '../../src/types/llm';

describe('Searcher', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    llmProvider = createTestLLMProvider();
  });

  it('should initialize correctly', () => {
    const searcher = new Searcher('test_searcher', llmProvider);
    
    expect(searcher.name).toBe('test_searcher');
    expect(searcher.llm).toBe(llmProvider);
  });

  it('should perform search and return results', async () => {
    const searcher = new Searcher('test_searcher', llmProvider);
    const query = 'What is TypeScript?';

    const result = await searcher.search(query);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('should handle empty query', async () => {
    const searcher = new Searcher('test_searcher', llmProvider);
    
    const result = await searcher.search('');
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Empty query');
  });

  it('should summarize search results', async () => {
    const searcher = new Searcher('test_searcher', llmProvider);
    const query = 'Latest developments in AI';

    const result = await searcher.searchAndSummarize(query);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('should handle search errors gracefully', async () => {
    const searcher = new Searcher('test_searcher', llmProvider);
    const invalidQuery = '!@#$%^&*()';

    const result = await searcher.search(invalidQuery);
    expect(result.status).toBe('failed');
    expect(result.content).toContain('error');
  });
}); 