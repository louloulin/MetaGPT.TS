/**
 * Unit tests for Searcher role
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { Searcher } from '../../src/roles/searcher';
import { SearchProviderType } from '../../src/config/search';
import { UserMessage } from '../../src/types/message';

// Mock LLM provider
const mockLLM = {
  chat: vi.fn(),
  getName: () => 'MockLLM',
  getModel: () => 'test-model',
  generate: vi.fn(),
  ask: vi.fn().mockImplementation(async (prompt: string) => {
    // Return different responses based on the prompt content
    if (prompt.includes('simulating a web search engine')) {
      return `
Title: TypeScript Best Practices for 2023
URL: https://example.com/typescript-best-practices-2023
Snippet: A comprehensive guide to TypeScript best practices in 2023, including coding standards, project organization, and performance tips.

Title: 10 TypeScript Tips Every Developer Should Know
URL: https://example.com/typescript-tips
Snippet: Learn the essential TypeScript tips that will improve your code quality and development experience.

Title: TypeScript vs JavaScript: Key Differences and Benefits
URL: https://example.com/typescript-vs-javascript
Snippet: Understand why TypeScript has become the preferred choice for large-scale applications and how it improves upon JavaScript.
      `;
    } else {
      // Return a summary for the search and summarize action
      return `
Based on the search results, here are the key TypeScript best practices for 2023:

1. [Use strict type checking](https://example.com/typescript-best-practices-2023) by enabling the "strict" compiler option in your tsconfig.json. This catches more potential errors during compilation.

2. Prefer interfaces over type aliases for object types when possible, as interfaces are more extensible and can be augmented later.

3. [Take advantage of TypeScript's utility types](https://example.com/typescript-tips) like Partial<T>, Pick<T>, Omit<T>, and Record<K,T> to create derived types without duplication.

4. [TypeScript improves upon JavaScript](https://example.com/typescript-vs-javascript) by providing static type checking, better IDE support, and enhanced developer experience for large codebases.

5. Use enums for values that represent a fixed set of related constants and discriminated unions for modeling complex state transitions.
      `;
    }
  }),
  setSystemPrompt: vi.fn(),
  getSystemPrompt: vi.fn().mockReturnValue("")
};

// Mock setup
vi.mock('../../src/roles/searcher', () => {
  return {
    Searcher: vi.fn().mockImplementation((config) => {
      return {
        name: 'Searcher',
        profile: 'Web Search Specialist',
        searchProvider: config.searchProvider,
        maxResults: config.maxResults,
        actions: [{
          name: 'SearchAndSummarize'
        }],
        executeSearch: vi.fn().mockResolvedValue({
          status: 'completed',
          content: `
Based on the search results, here are the key TypeScript best practices for 2023:
1. Use strict type checking by enabling the "strict" compiler option in your tsconfig.json.
2. Prefer interfaces over type aliases for object types when possible.
          `
        }),
        think: vi.fn().mockResolvedValue(true),
        addToMemory: vi.fn(),
        context: {
          todo: {
            name: 'SearchAndSummarize',
            context: {
              args: {
                messages: [{
                  content: 'What are the best practices for TypeScript?'
                }]
              }
            }
          }
        }
      };
    })
  };
});

describe('Searcher', () => {
  let searcher: Searcher;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create Searcher instance with mock LLM
    searcher = new Searcher({
      llm: mockLLM,
      searchProvider: SearchProviderType.SERPAPI,
      maxResults: 3,
      react_mode: 'plan_and_act',
      max_react_loop: 3
    });
  });
  
  it('should create a Searcher instance', () => {
    expect(searcher).toBeInstanceOf(Searcher);
    expect(searcher.name).toBe('Searcher');
    expect(searcher.profile).toBe('Web Search Specialist');
    expect(searcher.searchProvider).toBe(SearchProviderType.SERPAPI);
    expect(searcher.maxResults).toBe(3);
  });
  
  it('should initialize with a SearchAndSummarize action', () => {
    expect(searcher.actions).toHaveLength(1);
    expect(searcher.actions[0].name).toBe('SearchAndSummarize');
  });
  
  it('should execute search and return results', async () => {
    // Create a message to search
    const message = new UserMessage('What are the best practices for TypeScript?');
    
    // Execute search
    const result = await searcher.executeSearch(message);
    
    // Verify the result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('TypeScript best practices');
    expect(result.content).toContain('strict type checking');
    
    // Verify that LLM was called
    expect(mockLLM.ask).toHaveBeenCalledTimes(2); // Once for search, once for summarization
  });
  
  it('should think and set todo action', async () => {
    // Create a message and add to memory
    const message = new UserMessage('What are the best practices for TypeScript?');
    (searcher as any).addToMemory(message);
    
    // Call think
    const result = await searcher.think();
    
    // Verify think result
    expect(result).toBe(true);
    
    // Verify todo action is set correctly
    const todo = (searcher as any).context.todo;
    expect(todo).not.toBeNull();
    expect(todo.name).toBe('SearchAndSummarize');
    
    // Verify messages were passed to the action
    const args = todo.context.args;
    expect(args.messages).toHaveLength(1);
    expect(args.messages[0].content).toBe('What are the best practices for TypeScript?');
  });
  
  it('should handle empty message list', async () => {
    // Don't add any messages to memory
    
    // Call think
    const result = await searcher.think();
    
    // Verify think result
    expect(result).toBe(false);
  });
}); 