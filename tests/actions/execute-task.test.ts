/**
 * Unit tests for ExecuteTask action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecuteTask } from '../../src/actions/execute-task';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import type { Task } from '../../src/types/task';
import type { LLMProvider } from '../../src/types/llm';

describe('ExecuteTask', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    // Create a new LLM provider for each test
    llmProvider = createTestLLMProvider();
  });

  it('should initialize with correct properties', () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: llmProvider,
      instruction: 'Analyze the data and provide insights'
    });
    
    expect(executeTask).toBeInstanceOf(ExecuteTask);
    expect(executeTask['name']).toBe('ExecuteTask');
    expect(executeTask['llm']).toBe(llmProvider);
    expect(executeTask['task']).toBeDefined();
    expect(executeTask['task']?.description).toBe('Analyze the data and provide insights');
  });

  it('should initialize with provided task', () => {
    const task: Task = {
      id: 'test-task-123',
      title: 'Test Task',
      description: 'Run a complex analysis task',
      task_type: 'DATA_ANALYSIS',
      status: 'pending'
    };

    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: llmProvider,
      task
    });
    
    expect(executeTask['task']).toEqual(task);
  });

  it('should fail when no instruction is provided', async () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: llmProvider
    });
    
    const result = await executeTask.run();
    
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No task instruction provided');
  });
  
  it('should fail when no LLM provider is set', async () => {
    const executeTaskNoLLM = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: null as any,
      instruction: 'Analyze the data and provide insights'
    });
    
    const result = await executeTaskNoLLM.run();
    
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Failed to execute task');
  });

  it('should execute a data analysis task successfully', async () => {
    const task: Task = {
      id: 'data-analysis-task',
      title: 'Data Analysis Task',
      description: 'Analyze the dataset and provide summary statistics',
      task_type: 'DATA_ANALYSIS',
      status: 'pending'
    };

    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: llmProvider,
      task
    });
    
    const result = await executeTask.run();
    
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.instructContent).toBeDefined();
    expect(executeTask['task']?.status).toBe('completed');
  });

  it('should execute a general task using instruction parameter', async () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: llmProvider,
      instruction: 'Perform a general task',
      taskType: 'GENERAL'
    });
    
    const result = await executeTask.run();
    
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.instructContent).toBeDefined();
  });

  it('should handle simulation mode correctly', async () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: llmProvider,
      instruction: 'Perform a simulated task',
      simulate: true
    });
    
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    const result = await executeTask.run();
    
    expect(result.status).toBe('completed');
    expect(result.content).toContain('[Simulation]');
    expect(result.instructContent).toBeDefined();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Simulation mode'));
  });

  it('should handle task timeout correctly', async () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: llmProvider,
      instruction: 'This will timeout',
      timeout: 1
    });
    
    const handleExceptionSpy = vi.spyOn(executeTask as any, 'handleException');
    
    const result = await executeTask.run();
    
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Failed to execute task');
    expect(handleExceptionSpy).toHaveBeenCalled();
    expect(executeTask['task']?.status).toBe('failed');
  });
}); 