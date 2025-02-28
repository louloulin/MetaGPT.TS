import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProjectManagement } from '../../src/actions/project-management';
import { MockLLM } from '../mocks/mock-llm';
import { z } from 'zod';
import { ArrayMemory } from '../../src/types/memory';

// Create a mock memory for testing
const createMockMemory = () => {
  return new ArrayMemory();
};

describe('ProjectManagement', () => {
  // Mock LLM that returns predefined responses for different prompts
  let mockLLM: MockLLM;
  
  beforeEach(() => {
    // Create a new mock LLM for each test
    mockLLM = new MockLLM({
      // Define responses for different types of nodes
      responses: {
        'Required packages': JSON.stringify(['express@4.17.1', 'typescript@4.7.4']),
        'Required Other language third-party packages': JSON.stringify([]),
        'Logic Analysis': JSON.stringify([
          ['app.ts', 'Contains App class and initialization logic'],
          ['server.ts', 'Contains Server class and HTTP server setup']
        ]),
        'Task list': JSON.stringify(['server.ts', 'app.ts']),
        'Full API spec': JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'Project API',
            version: '1.0.0'
          }
        }),
        'Shared Knowledge': JSON.stringify({
          content: '`utils.ts` contains shared utility functions.'
        }),
        'Anything UNCLEAR': JSON.stringify({
          content: 'No unclear aspects at this time.'
        })
      }
    });
    
    // Log the responses for debugging
    console.log('Mock LLM responses:', mockLLM['responses']);
  });

  it('should initialize with correct properties', () => {
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: mockLLM,
      memory: createMockMemory()
    });
    
    expect(projectManagement).toBeInstanceOf(ProjectManagement);
    expect(projectManagement['name']).toBe('ProjectManagement');
    expect(projectManagement['llm']).toBe(mockLLM);
  });

  it('should initialize with refined nodes when isRefined is true', () => {
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: mockLLM,
      isRefined: true,
      memory: createMockMemory()
    });
    
    expect(projectManagement['isRefined']).toBe(true);
    // The test assumes that REFINED_NODES array includes elements like 'Refined Logic Analysis'
    expect(projectManagement['nodes'].some(node => node.key === 'Refined Logic Analysis')).toBe(true);
  });

  it('should execute all nodes and return complete project management plan', async () => {
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: mockLLM,
      args: {
        context: 'Create a simple Express web server'
      },
      memory: createMockMemory()
    });
    
    // Spy on the executeNode method
    const executeNodeSpy = vi.spyOn(projectManagement as any, 'executeNode');
    
    const result = await projectManagement.run();
    
    // Verify that executeNode was called for each node
    expect(executeNodeSpy).toHaveBeenCalledTimes(7); // Number of nodes in NODES array
    
    // Verify that the result contains the expected keys and values
    expect(result.status).toBe('completed');
    
    const content = JSON.parse(result.content);
    expect(content['Required packages']).toEqual(['express@4.17.1', 'typescript@4.7.4']);
    expect(content['Required Other language third-party packages']).toEqual([]);
    expect(content['Logic Analysis']).toEqual([
      ['app.ts', 'Contains App class and initialization logic'],
      ['server.ts', 'Contains Server class and HTTP server setup']
    ]);
    expect(content['Task list']).toEqual(['server.ts', 'app.ts']);
    expect(content['Full API spec'].openapi).toBe('3.0.0');
    expect(content['Shared Knowledge'].content).toContain('utility functions');
    expect(content['Anything UNCLEAR'].content).toContain('No unclear aspects');
  });

  it('should handle errors during node execution', async () => {
    // Create a mock LLM that will throw an error for a specific node
    const errorMockLLM = new MockLLM({
      responses: {
        'Required packages': JSON.stringify(['express@4.17.1']),
        'Required Other language third-party packages': JSON.stringify([]),
        'Logic Analysis': JSON.stringify([]),
        'Task list': 'error',  // This will cause an error
        'Full API spec': JSON.stringify({}),
        'Shared Knowledge': JSON.stringify({}),
        'Anything UNCLEAR': JSON.stringify({})
      },
      generateFn: async (prompt: string): Promise<string> => {
        if (prompt.includes('Task list')) {
          throw new Error('Failed to generate task list');
        }
        // For other prompts, try to find a matching response
        const responses = (errorMockLLM as MockLLM)['responses'];
        for (const [key, response] of Object.entries(responses)) {
          if (prompt.includes(key)) {
            return response;
          }
        }
        return '[]';
      }
    });
    
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: errorMockLLM,
      args: {
        context: 'Create a simple Express web server'
      },
      memory: createMockMemory()
    });
    
    const result = await projectManagement.run();
    
    expect(result.status).toBe('completed');
    const content = JSON.parse(result.content);
    expect(content['Required packages']).toEqual(['express@4.17.1']);
    expect(content['Task list']).toBe('Error: Failed to generate task list');
  });

  it('should handle parsing errors gracefully', async () => {
    // Create a mock LLM that returns invalid JSON for a specific node
    const invalidJsonMockLLM = new MockLLM({
      responses: {
        'Required packages': 'This is not valid JSON',
        'Required Other language third-party packages': JSON.stringify([]),
        'Logic Analysis': 'Also not valid JSON',
        'Task list': JSON.stringify([]),
        'Full API spec': JSON.stringify({}),
        'Shared Knowledge': JSON.stringify({}),
        'Anything UNCLEAR': JSON.stringify({})
      }
    });
    
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: invalidJsonMockLLM,
      args: {
        context: 'Create a simple Express web server'
      },
      memory: createMockMemory()
    });
    
    const result = await projectManagement.run();
    
    expect(result.status).toBe('completed');
    const content = JSON.parse(result.content);
    // The raw text should be returned for nodes with parsing errors
    expect(content['Required packages']).toBe('This is not valid JSON');
    expect(content['Logic Analysis']).toBe('Also not valid JSON');
    expect(content['Task list']).toEqual([]);
  });
}); 