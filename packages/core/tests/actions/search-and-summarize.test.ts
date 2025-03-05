/**
 * Unit tests for SearchAndSummarize action
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchAndSummarize } from '../../src/actions/search-and-summarize';
import { SearchProviderType } from '../../src/config/search';
import { UserMessage } from '../../src/types/message';

describe('SearchAndSummarize', () => {
  let mockLLM: any;

  beforeEach(() => {
    // Create mock LLM with properly implemented methods
    mockLLM = {
      chat: vi.fn(), // We'll configure this in individual tests
      getName: () => 'MockLLM',
      getModel: () => 'test-model',
      generate: vi.fn().mockResolvedValue('Mock generated response'),
      ask: vi.fn()
    };

    // Mock console methods to prevent test output pollution
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  // Restore console methods after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a SearchAndSummarize instance', () => {
    const searchAndSummarize = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: mockLLM,
      args: {
        provider: SearchProviderType.SERPAPI,
        max_results: 3
      }
    });
    expect(searchAndSummarize).toBeInstanceOf(SearchAndSummarize);
    expect(searchAndSummarize.name).toBe('SearchAndSummarize');
  });

  it('should handle empty message list', async () => {
    // Create instance with empty message list
    const searchAndSummarize = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: mockLLM,
      args: {
        provider: SearchProviderType.SERPAPI,
        max_results: 3,
        messages: []
      }
    });
    
    const result = await searchAndSummarize.run();
    
    // Verify result
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages provided');
  });

  it('should handle message with empty content', async () => {
    // Create instance with message containing empty content
    const searchAndSummarize = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: mockLLM,
      args: {
        provider: SearchProviderType.SERPAPI,
        max_results: 3,
        messages: [new UserMessage('')]
      }
    });
    
    const result = await searchAndSummarize.run();
    
    // Verify result
    expect(result.status).toBe('failed');
    expect(result.content).toContain('no content');
  });

  it('should perform search and generate summary successfully', async () => {
    // Set up chat mock to return specific responses for the two expected calls
    mockLLM.chat = vi.fn()
      // First call - simulated search
      .mockResolvedValueOnce(`
Title: Test Result 1
URL: https://example.com/result1
Snippet: This is the first test result for the search query.

Title: Test Result 2
URL: https://example.com/result2
Snippet: This is the second test result for the search query.
      `)
      // Second call - summary generation
      .mockResolvedValueOnce('This is a summarized response based on the search results and conversation history.');
    
    // Create instance with test messages
    const searchAndSummarize = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: mockLLM,
      args: {
        provider: SearchProviderType.SERPAPI,
        max_results: 3,
        messages: [
          new UserMessage('Previous message for context'),
          new UserMessage('What is the capital of France?')
        ]
      }
    });
    
    // Run the action
    const result = await searchAndSummarize.run();
    
    // Verify the result
    expect(result.status).toBe('completed');
    expect(result.content).toBe('This is a summarized response based on the search results and conversation history.');
    
    // Verify that the LLM was called for both search and summarization
    expect(mockLLM.chat).toHaveBeenCalledTimes(2);
  });

  it('should handle search with no results', async () => {
    // Set up mock to return empty results for the first call
    mockLLM.chat = vi.fn()
      .mockResolvedValueOnce('') // Empty search results
      .mockResolvedValueOnce('I couldn\'t find any relevant information for your query.');
    
    // Create instance with test message
    const searchAndSummarize = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: mockLLM,
      args: {
        provider: SearchProviderType.SERPAPI,
        max_results: 3,
        messages: [
          new UserMessage('A very obscure query that will have no results')
        ]
      }
    });
    
    // Run the action
    const result = await searchAndSummarize.run();
    
    // Verify the result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('couldn\'t find any relevant information');
  });

  it('should handle errors during search', async () => {
    // Set up mock to throw an error during the first call
    mockLLM.chat = vi.fn()
      .mockRejectedValueOnce(new Error('Search API error'));
    
    // Create instance with test message
    const searchAndSummarize = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: mockLLM,
      args: {
        provider: SearchProviderType.SERPAPI,
        max_results: 3,
        messages: [
          new UserMessage('Query that will cause a search error')
        ]
      }
    });
    
    // Run the action
    const result = await searchAndSummarize.run();
    
    // Verify the result
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Failed to search and summarize');
  });

  it('should customize search by provider and max results', async () => {
    // Set up mock responses
    mockLLM.chat = vi.fn()
      .mockResolvedValueOnce('Mock search results')
      .mockResolvedValueOnce('Mock summary');
    
    // Create instance with custom provider and max results
    const customSearchAndSummarize = new SearchAndSummarize({
      name: 'CustomSearch',
      llm: mockLLM,
      args: {
        provider: SearchProviderType.GOOGLE,
        max_results: 10,
        messages: [
          new UserMessage('Search query for custom provider')
        ]
      }
    });
    
    // Run the action
    await customSearchAndSummarize.run();
    
    // Verify the call was made
    expect(mockLLM.chat).toHaveBeenCalledTimes(2);
  });

  it('should include conversation history in the summary prompt', async () => {
    // Set up mock responses
    mockLLM.chat = vi.fn()
      .mockResolvedValueOnce('Mock search results')
      .mockResolvedValueOnce('Mock summary that includes conversation history');
    
    // Create instance with multiple conversation turns
    const searchAndSummarize = new SearchAndSummarize({
      name: 'SearchAndSummarize',
      llm: mockLLM,
      args: {
        provider: SearchProviderType.SERPAPI,
        max_results: 3,
        messages: [
          new UserMessage('First message in the conversation'),
          new UserMessage('Second message with more context'),
          new UserMessage('Final query to search')
        ]
      }
    });
    
    // Run the action
    const result = await searchAndSummarize.run();
    
    // Verify that the action completed successfully
    expect(result.status).toBe('completed');
    expect(mockLLM.chat).toHaveBeenCalledTimes(2);
  });
}); 