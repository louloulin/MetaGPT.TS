import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FixBug } from '../../src/actions/fix-bug';
import { MockLLM } from '../mocks/mock-llm';

describe('FixBug', () => {
  // Mock LLM that returns predefined responses for different prompts
  let mockLLM: MockLLM;
  
  beforeEach(() => {
    // Create a new mock LLM for each test
    mockLLM = new MockLLM({
      // Define responses for different types of nodes
      responses: {
        'Bug Analysis': 'The bug is caused by accessing a property on an undefined object.',
        'Possible Causes': JSON.stringify([
          'Missing null check before accessing properties',
          'API response not properly handled',
          'Race condition in data loading'
        ]),
        'Reproduction Steps': JSON.stringify([
          '1. Load the application',
          '2. Navigate to user profile without waiting for data',
          '3. Observe error in console'
        ]),
        'Fix Strategy': 'Add null checks and implement proper loading states.',
        'Code Changes': JSON.stringify([
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
        ]),
        'Test Cases': JSON.stringify([
          {
            description: 'User profile with null data',
            steps: [
              'Load profile without data',
              'Check for error handling'
            ],
            expectedResult: 'Should display "Guest" and not crash'
          }
        ]),
        'Prevention Strategy': 'Add TypeScript strict null checks and implement loading states.',
        'Anything UNCLEAR': 'No unclear aspects at this time.'
      }
    });
  });

  it('should initialize with correct properties', () => {
    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: mockLLM
    });
    
    expect(fixBug).toBeInstanceOf(FixBug);
    expect(fixBug['name']).toBe('FixBug');
    expect(fixBug['llm']).toBe(mockLLM);
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
      llm: mockLLM,
      bugDetails
    });
    
    expect(fixBug['bugDetails']).toEqual(bugDetails);
  });

  it('should execute all nodes and return complete bug fix plan', async () => {
    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: mockLLM,
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
      llm: mockLLM,
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
    // Create a mock LLM that will throw an error for a specific node
    const errorMockLLM = new MockLLM({
      responses: {},
      generateFn: async (prompt: string) => {
        if (prompt.includes('Code Changes')) {
          throw new Error('Failed to generate code changes');
        }
        return '[]';
      }
    });
    
    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: errorMockLLM,
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
    // Create a mock LLM that returns invalid JSON for a specific node
    const invalidJsonMockLLM = new MockLLM({
      responses: {
        'Possible Causes': 'This is not valid JSON',
        'Code Changes': 'Also not valid JSON',
      }
    });
    
    const fixBug = new FixBug({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      llm: invalidJsonMockLLM,
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