import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProjectManagement } from '../../src/actions/project-management';
import { createLLMProvider } from '../mocks/llm-provider';
import { z } from 'zod';
import { ArrayMemory } from '../../src/types/memory';

// Create a mock memory for testing
const createMockMemory = () => {
  return new ArrayMemory();
};

describe('ProjectManagement', () => {
  // LLM provider for tests
  let llmProvider: any;
  
  beforeEach(() => {
    // Create a new LLM provider with custom system prompt
    const systemPrompt = "You are a project management expert. Provide structured responses for project planning.";
    llmProvider = createLLMProvider(systemPrompt);
    
    // Mock the chat method to return predefined responses
    llmProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('Required packages')) {
        return JSON.stringify(['express@4.17.1', 'typescript@4.7.4']);
      } else if (prompt.includes('Required Other language third-party packages')) {
        return JSON.stringify([]);
      } else if (prompt.includes('Logic Analysis')) {
        return JSON.stringify([
          ['app.ts', 'Contains App class and initialization logic'],
          ['server.ts', 'Contains Server class and HTTP server setup']
        ]);
      } else if (prompt.includes('Task list')) {
        return JSON.stringify(['server.ts', 'app.ts']);
      } else if (prompt.includes('Full API spec')) {
        return JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'Project API',
            version: '1.0.0'
          }
        });
      } else if (prompt.includes('Shared Knowledge')) {
        return JSON.stringify({
          content: '`utils.ts` contains shared utility functions.'
        });
      } else if (prompt.includes('Anything UNCLEAR')) {
        return JSON.stringify({
          content: 'No unclear aspects at this time.'
        });
      }
      
      return '[]';
    });
  });

  it('should initialize with correct properties', () => {
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: llmProvider,
      memory: createMockMemory()
    });
    
    expect(projectManagement).toBeInstanceOf(ProjectManagement);
    expect(projectManagement['name']).toBe('ProjectManagement');
    expect(projectManagement['llm']).toBe(llmProvider);
  });

  it('should initialize with refined nodes when isRefined is true', () => {
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: llmProvider,
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
      llm: llmProvider,
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
    // Create an LLM provider that will throw an error for a specific node
    const errorLLMProvider = createLLMProvider("Error simulation");
    errorLLMProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('Task list')) {
        throw new Error('Failed to generate task list');
      } else if (prompt.includes('Required packages')) {
        return JSON.stringify(['express@4.17.1']);
      } else if (prompt.includes('Required Other language third-party packages')) {
        return JSON.stringify([]);
      } else if (prompt.includes('Logic Analysis')) {
        return JSON.stringify([]);
      } else if (prompt.includes('Full API spec')) {
        return JSON.stringify({});
      } else if (prompt.includes('Shared Knowledge')) {
        return JSON.stringify({});
      } else if (prompt.includes('Anything UNCLEAR')) {
        return JSON.stringify({});
      }
      
      return '[]';
    });
    
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: errorLLMProvider,
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
    // Create an LLM provider that returns invalid JSON for specific nodes
    const invalidJsonLLMProvider = createLLMProvider("Invalid JSON simulation");
    invalidJsonLLMProvider.chat = vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('Required packages')) {
        return 'This is not valid JSON';
      } else if (prompt.includes('Required Other language third-party packages')) {
        return JSON.stringify([]);
      } else if (prompt.includes('Logic Analysis')) {
        return 'Also not valid JSON';
      } else if (prompt.includes('Task list')) {
        return JSON.stringify([]);
      } else if (prompt.includes('Full API spec')) {
        return JSON.stringify({});
      } else if (prompt.includes('Shared Knowledge')) {
        return JSON.stringify({});
      } else if (prompt.includes('Anything UNCLEAR')) {
        return JSON.stringify({});
      }
      
      return '[]';
    });
    
    const projectManagement = new ProjectManagement({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      llm: invalidJsonLLMProvider,
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