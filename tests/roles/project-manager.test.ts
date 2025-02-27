/**
 * Unit tests for ProjectManager role
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from '../../src/roles/project-manager';
import { UserMessage } from '../../src/types/message';

describe('ProjectManager', () => {
  let mockLLM: any;

  beforeEach(() => {
    // Create mock LLM with properly implemented methods
    mockLLM = {
      chat: vi.fn().mockResolvedValue('Mock response from LLM'),
      getName: () => 'MockLLM',
      getModel: () => 'test-model',
      generate: vi.fn().mockResolvedValue('Mock generated response'),
      ask: vi.fn().mockResolvedValue('Mock response'),
      setSystemPrompt: vi.fn(),
      getSystemPrompt: vi.fn().mockReturnValue('')
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

  it('should create a ProjectManager instance', () => {
    const projectManager = new ProjectManager({
      name: 'TestProjectManager',
      llm: mockLLM,
      profile: 'Test Profile',
      goal: 'Test Goal',
      constraints: 'Test Constraints',
      isRefined: true
    });
    
    expect(projectManager).toBeInstanceOf(ProjectManager);
    expect(projectManager.name).toBe('TestProjectManager');
  });

  it('should use default values if not provided', () => {
    const projectManager = new ProjectManager({
      llm: mockLLM
    });
    
    expect(projectManager).toBeInstanceOf(ProjectManager);
    expect(projectManager.name).toBe('Eve');
  });

  it('should handle project management messages', async () => {
    // Configure LLM mock to return appropriate responses
    mockLLM.chat.mockImplementation((messages: any) => {
      return 'Task breakdown: 1. Setup environment, 2. Create core components, 3. Implement features';
    });
    
    const projectManager = new ProjectManager({
      llm: mockLLM
    });
    
    // Create a user message related to project management
    const userMessage = new UserMessage('Break down this project into tasks: Create a web application with user authentication');
    
    // Run the role with the message
    const response = await projectManager.run(userMessage);
    
    // Verify response
    expect(response).toBeDefined();
    expect(response.content).toContain('Task breakdown');
    expect(mockLLM.chat).toHaveBeenCalled();
  });

  it('should handle task dependency analysis', async () => {
    // Configure LLM mock to return appropriate responses for dependency analysis
    mockLLM.chat.mockImplementation((messages: any) => {
      if (messages.some((m: any) => m.content.includes('dependency'))) {
        return 'Dependencies: Task 1 -> Task 3, Task 2 -> Task 4';
      } else {
        return 'Task list: 1. Design database, 2. Create API, 3. Implement frontend, 4. Add tests';
      }
    });
    
    const projectManager = new ProjectManager({
      llm: mockLLM
    });
    
    // Create a user message related to dependency analysis
    const userMessage = new UserMessage('Analyze dependencies in this project: Create a full-stack application');
    
    // Run the role with the message
    const response = await projectManager.run(userMessage);
    
    // Verify response
    expect(response).toBeDefined();
    expect(mockLLM.chat).toHaveBeenCalled();
  });

  it('should handle resource planning', async () => {
    // Configure LLM mock to return appropriate responses for resource planning
    mockLLM.chat.mockImplementation((messages: any) => {
      return 'Resource plan: Frontend development - 2 weeks, Backend development - 3 weeks, Testing - 1 week';
    });
    
    const projectManager = new ProjectManager({
      llm: mockLLM
    });
    
    // Create a user message related to resource planning
    const userMessage = new UserMessage('Create a resource plan for this project: E-commerce website with payment integration');
    
    // Run the role with the message
    const response = await projectManager.run(userMessage);
    
    // Verify response
    expect(response).toBeDefined();
    expect(response.content).toContain('Resource plan');
    expect(mockLLM.chat).toHaveBeenCalled();
  });

  it('should ignore non-project related messages', async () => {
    // Configure LLM mock to return appropriate responses
    mockLLM.generate.mockResolvedValue('General response about unrelated topic');
    
    const projectManager = new ProjectManager({
      llm: mockLLM
    });
    
    // Create a user message not related to project management
    const userMessage = new UserMessage('Tell me about the weather today');
    
    // Run the role with the message
    await projectManager.run(userMessage);
    
    // Since this is unrelated to project management, the role should use the default BaseRole behavior
    // which we can't directly test, but we can verify it called the LLM
    expect(mockLLM.chat).toHaveBeenCalled();
  });
}); 