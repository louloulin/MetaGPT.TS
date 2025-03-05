import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteRequirements, RequirementType, RequirementPriority } from '../../src/actions/write-requirements';
import { UserMessage } from '../../src/types/message';

describe('WriteRequirements', () => {
  let mockLLM: any;
  let writeRequirements: WriteRequirements;

  beforeEach(() => {
    // Create mock LLM
    mockLLM = {
      chat: vi.fn(),
      getName: () => 'MockLLM',
      getModel: () => 'test-model',
      generate: vi.fn(),
    };

    // Create WriteRequirements instance
    writeRequirements = new WriteRequirements({
      name: 'WriteRequirements',
      llm: mockLLM,
      args: {
        project_name: 'Test Project',
        include_technical: true,
        include_security: true
      }
    });
  });

  it('should create a WriteRequirements instance', () => {
    expect(writeRequirements).toBeInstanceOf(WriteRequirements);
    expect(writeRequirements.name).toBe('WriteRequirements');
  });

  it('should handle empty message list', async () => {
    const result = await writeRequirements.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages available');
  });

  it('should generate requirements document successfully', async () => {
    // Mock successful LLM response
    const mockDocument = {
      project_name: 'Task Management System',
      version: '1.0.0',
      last_updated: '2024-03-20T10:00:00Z',
      executive_summary: 'A system for managing tasks and projects',
      scope: {
        included: ['Task CRUD operations', 'User management'],
        excluded: ['Calendar integration']
      },
      assumptions: ['Users have basic computer skills'],
      constraints: ['Must work in modern browsers'],
      requirements: [
        {
          title: 'Task Creation',
          description: 'Users should be able to create new tasks',
          type: RequirementType.FUNCTIONAL,
          priority: RequirementPriority.MUST_HAVE,
          acceptance_criteria: ['User can create task with title and description'],
          stakeholders: ['Project Manager', 'Team Members']
        },
        {
          title: 'Data Security',
          description: 'System must secure user data',
          type: RequirementType.SECURITY,
          priority: RequirementPriority.MUST_HAVE,
          acceptance_criteria: ['All data is encrypted at rest']
        }
      ],
      risks: [
        {
          description: 'User adoption may be slow',
          impact: 'MEDIUM',
          mitigation: 'Provide user training'
        }
      ]
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockDocument));

    // Add a message to process
    writeRequirements.context.memory.add(new UserMessage('Create requirements for a task management system'));

    // Run requirements generation
    const result = await writeRequirements.run();

    // Verify result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Task Management System Requirements Document');
    expect(result.content).toContain('## Executive Summary');
    expect(result.content).toContain('A system for managing tasks and projects');
    expect(result.content).toContain('Task CRUD operations');
    expect(result.content).toContain('FUN-001: Task Creation');
    expect(result.content).toContain('SEC-002: Data Security');
    expect(result.content).toContain('Impact: MEDIUM');
  });

  it('should handle LLM response parsing error', async () => {
    // Mock LLM response with invalid JSON
    mockLLM.chat.mockResolvedValue('Invalid JSON response');

    // Add a message to process
    writeRequirements.context.memory.add(new UserMessage('Create requirements document'));

    // Run requirements generation
    const result = await writeRequirements.run();

    // Verify fallback behavior
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Test Project Requirements Document');
    expect(result.content).toContain('Basic requirements document for:');
    expect(result.content).toContain('FUN-001: Basic Functionality');
    expect(result.content).toContain('Standard development environment');
  });

  it('should handle missing fields in LLM response', async () => {
    // Mock LLM response with missing fields
    const partialDocument = {
      project_name: 'Partial Project',
      executive_summary: 'Basic project description'
      // Other fields missing
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(partialDocument));

    // Add a message to process
    writeRequirements.context.memory.add(new UserMessage('Create requirements'));

    // Run requirements generation
    const result = await writeRequirements.run();

    // Verify default values are used
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Partial Project Requirements Document');
    expect(result.content).toContain('Version: 1.0.0');
    expect(result.content).toContain('Basic project description');
    expect(result.content).toContain('### Included');
    expect(result.content).toContain('### Excluded');
  });

  it('should respect configuration options', async () => {
    // Create instance with specific configuration
    const customRequirements = new WriteRequirements({
      name: 'WriteRequirements',
      llm: mockLLM,
      args: {
        project_name: 'Custom Project',
        scope_focus: ['Security', 'Performance'],
        stakeholders: ['Security Team', 'DevOps'],
        include_technical: true,
        include_security: true,
        include_performance: true
      }
    });

    // Mock successful LLM response with security and performance requirements
    const mockDocument = {
      project_name: 'Custom Project',
      version: '1.0.0',
      requirements: [
        {
          title: 'Security Compliance',
          description: 'Must comply with security standards',
          type: RequirementType.SECURITY,
          priority: RequirementPriority.MUST_HAVE,
          acceptance_criteria: ['Passes security audit'],
          stakeholders: ['Security Team']
        },
        {
          title: 'Performance Metrics',
          description: 'System must meet performance targets',
          type: RequirementType.PERFORMANCE,
          priority: RequirementPriority.SHOULD_HAVE,
          acceptance_criteria: ['Response time under 200ms'],
          stakeholders: ['DevOps']
        }
      ]
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockDocument));

    // Add a message to process
    customRequirements.context.memory.add(new UserMessage('Create security and performance requirements'));

    // Run requirements generation
    const result = await customRequirements.run();

    // Verify configuration was respected
    expect(result.content).toContain('# Custom Project Requirements Document');
    expect(result.content).toContain('SEC-001: Security Compliance');
    expect(result.content).toContain('PER-002: Performance Metrics');
    expect(result.content).toContain('Security Team');
    expect(result.content).toContain('DevOps');
  });
}); 