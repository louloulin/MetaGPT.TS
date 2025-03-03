import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FixBug } from '../../src/actions/fix-bug';
import { createLLMProvider } from '../mocks/llm-provider';

describe('FixBug', () => {
  // LLM provider for tests
  let llmProvider: any;
  
  beforeEach(() => {
    // Create a new LLM provider with custom system prompt for each test
    const systemPrompt = "You are a debugging expert. Respond with appropriate formats for each query type.";
    llmProvider = createLLMProvider(systemPrompt);
    
    // Mock the chat method to return predefined responses
    llmProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('Bug Analysis')) {
        return 'The bug is caused by accessing a property on an undefined object.';
      } else if (prompt.includes('Possible Causes')) {
        return JSON.stringify([
          'Missing null check before accessing properties',
          'API response not properly handled',
          'Race condition in data loading'
        ]);
      } else if (prompt.includes('Reproduction Steps')) {
        return JSON.stringify([
          '1. Load the application',
          '2. Navigate to user profile without waiting for data',
          '3. Observe error in console'
        ]);
      } else if (prompt.includes('Fix Strategy')) {
        return 'Add null checks and implement proper loading states.';
      } else if (prompt.includes('Code Changes')) {
        return JSON.stringify([
          {
            file: 'src/components/UserProfile.tsx',
            changes: [
              {
                lineNumber: 42,
                original: 'const userName = user.profile.name;',
                replacement: 'const userName = user?.profile?.name || "Guest";'
              }
            ]
          }
        ]);
      } else if (prompt.includes('Test Cases')) {
        return JSON.stringify([
          {
            description: 'User profile with null data',
            steps: [
              'Load profile without data',
              'Check for error handling'
            ],
            expectedResult: 'Should display "Guest" and not crash'
          }
        ]);
      } else if (prompt.includes('Prevention Strategy')) {
        return 'Add TypeScript strict null checks and implement loading states.';
      } else if (prompt.includes('Anything UNCLEAR')) {
        return 'No unclear aspects at this time.';
      }
      return '[]';
    });
  });

  it('should initialize with correct properties', () => {
    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: llmProvider
    });
    
    expect(fixBug).toBeInstanceOf(FixBug);
    expect(fixBug['name']).toBe('FixBug');
    expect(fixBug['llm']).toBe(llmProvider);
  });

  it('should initialize with bug details when provided', () => {
    const bugDetails = {
      description: 'App crashes when accessing user profile',
      errorMessage: 'Cannot read property name of undefined',
      stackTrace: 'at UserProfile.tsx:42:20',
      codeContext: 'const userName = user.profile.name;'
    };

    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: llmProvider,
      bugDetails
    });
    
    expect(fixBug['bugDetails']).toEqual(bugDetails);
  });

  it('should execute all nodes and return complete bug fix plan', async () => {
    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: llmProvider,
      bugDetails: {
        description: 'App crashes when accessing user profile',
        errorMessage: 'Cannot read property name of undefined',
        stackTrace: 'at UserProfile.tsx:42:20',
        codeContext: 'const userName = user.profile.name;'
      }
    });
    
    // Spy on the executeNode method
    const executeNodeSpy = vi.spyOn(fixBug as any, 'executeNode');
    
    const result = await fixBug.run();
    
    // Verify that executeNode was called for each node
    expect(executeNodeSpy).toHaveBeenCalledTimes(8); // Number of nodes in BUG_NODES array
    
    // Verify that the result contains the expected keys and values
    expect(result.status).toBe('completed');
    
    const content = JSON.parse(result.content);
    expect(content['Bug Analysis']).toContain('undefined object');
    expect(content['Possible Causes']).toEqual([
      'Missing null check before accessing properties',
      'API response not properly handled',
      'Race condition in data loading'
    ]);
    expect(content['Code Changes']).toEqual([
      {
        file: 'src/components/UserProfile.tsx',
        changes: [
          {
            lineNumber: 42,
            original: 'const userName = user.profile.name;',
            replacement: 'const userName = user?.profile?.name || "Guest";'
          }
        ]
      }
    ]);
    expect(content['Prevention Strategy']).toContain('TypeScript strict null checks');
  });

  it('should extract context from message if provided', async () => {
    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: llmProvider,
      args: {
        message: {
          content: 'The application crashes when loading the user profile page.',
          role: 'user'
        }
      }
    });
    
    // Spy on the prepareBugContext method
    const prepareBugContextSpy = vi.spyOn(fixBug as any, 'prepareBugContext');
    
    await fixBug.run();
    
    // Verify that prepareBugContext was called
    expect(prepareBugContextSpy).toHaveBeenCalled();
    
    // Check that the message content is used in the context
    const context = prepareBugContextSpy.mock.results[0].value;
    expect(context).toContain('The application crashes when loading the user profile page.');
  });

  it('should handle errors during node execution', async () => {
    // Create an LLM provider that will throw an error for a specific node
    const errorLLMProvider = createLLMProvider("Error simulation");
    errorLLMProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('Code Changes')) {
        throw new Error('Failed to generate code changes');
      }
      return '[]';
    });
    
    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: errorLLMProvider,
      bugDetails: {
        description: 'App crashes when accessing user profile'
      }
    });
    
    // We expect the action to complete despite errors in individual nodes
    const result = await fixBug.run();
    
    expect(result.status).toBe('completed');
    // The content should still be parseable JSON
    expect(() => JSON.parse(result.content)).not.toThrow();
  });

  it('should handle parsing errors gracefully', async () => {
    // Create an LLM provider that returns invalid JSON for specific nodes
    const invalidJsonLLMProvider = createLLMProvider("Invalid JSON simulation");
    invalidJsonLLMProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('Possible Causes')) {
        return 'This is not valid JSON';
      } else if (prompt.includes('Code Changes')) {
        return 'Also not valid JSON';
      }
      return '[]';
    });
    
    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: invalidJsonLLMProvider,
      bugDetails: {
        description: 'App crashes when accessing user profile'
      }
    });
    
    const result = await fixBug.run();
    
    expect(result.status).toBe('completed');
    const content = JSON.parse(result.content);
    // The raw text should be returned for nodes with parsing errors
    expect(content['Possible Causes']).toBe('This is not valid JSON');
    expect(content['Code Changes']).toBe('Also not valid JSON');
  });
}); 