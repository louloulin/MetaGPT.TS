/**
 * Unit tests for ExecuteTask action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecuteTask } from '../../src/actions/execute-task';
import { MockLLM } from '../mocks/mock-llm';
import type { Task } from '../../src/types/task';

describe('ExecuteTask', () => {
  // Mock LLM that returns predefined responses for different prompts
  let mockLLM: MockLLM;
  
  beforeEach(() => {
    // Create a new mock LLM for each test
    mockLLM = new MockLLM({
      // Define responses for different types of tasks
      responses: {
        'DATA_ANALYSIS': `\`\`\`json
{
  "code": "import pandas as pd\\n\\ndf = pd.read_csv('data.csv')\\nresult = df.describe()\\nprint(result)",
  "result": "Data analysis completed. The dataset contains 1000 rows and 5 columns. Summary statistics show average age of 35.2 years with a standard deviation of 12.8.",
  "isSuccess": true
}
\`\`\``,
        'GENERAL': `\`\`\`json
{
  "code": "function performTask() { return 'Task completed'; }",
  "result": "Successfully executed the general task with the following approach: 1) Analyzed requirements, 2) Implemented solution, 3) Verified results",
  "isSuccess": true
}
\`\`\``,
        'ERROR_TASK': `This is an invalid response without JSON`,
        'TIMEOUT_TASK': 'This will cause a timeout error'
      },
      generateFn: async (prompt: string) => {
        if (prompt.includes('TIMEOUT_TASK')) {
          // Simulate timeout by never resolving
          return new Promise<string>(() => {
            // This promise intentionally doesn't resolve
          });
        }
        return 'Default response';
      }
    });
  });

  it('should initialize with correct properties', () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: mockLLM,
      instruction: 'Analyze the data and provide insights'
    });
    
    expect(executeTask).toBeInstanceOf(ExecuteTask);
    expect(executeTask['name']).toBe('ExecuteTask');
    expect(executeTask['llm']).toBe(mockLLM);
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
      llm: mockLLM,
      task
    });
    
    expect(executeTask['task']).toEqual(task);
  });

  it('should fail when no instruction is provided', async () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: mockLLM
    });
    
    // Execute the action without providing instructions
    const result = await executeTask.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No task instruction provided');
  });
  
  it('should fail when no LLM provider is set', async () => {
    // Create ExecuteTask instance without LLM
    const executeTaskNoLLM = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: null as any,
      instruction: 'Analyze the data and provide insights'
    });
    
    // Execute the action
    const result = await executeTaskNoLLM.run();
    
    // Verify that the action fails with appropriate message
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
      llm: mockLLM,
      task
    });
    
    // Execute the task
    const result = await executeTask.run();
    
    // Verify the task execution result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Data analysis completed');
    expect(result.instructContent).toBeDefined();
    expect(result.instructContent.code).toContain('import pandas as pd');
    expect(result.instructContent.isSuccess).toBe(true);
    
    // Verify task status is updated
    expect(executeTask['task']?.status).toBe('completed');
  });

  it('should execute a general task using instruction parameter', async () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: mockLLM,
      instruction: 'Perform a general task',
      taskType: 'GENERAL'
    });
    
    // Execute the task
    const result = await executeTask.run();
    
    // Verify the task execution result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Successfully executed the general task');
    expect(result.instructContent).toBeDefined();
    expect(result.instructContent.code).toContain('function performTask()');
    expect(result.instructContent.isSuccess).toBe(true);
  });

  it('should handle simulation mode correctly', async () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: mockLLM,
      instruction: 'Perform a simulated task',
      simulate: true
    });
    
    // Spy on logger.info to verify simulation logging
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    // Execute the task
    const result = await executeTask.run();
    
    // Verify simulation behavior
    expect(result.status).toBe('completed');
    expect(result.content).toContain('[Simulation] Task would execute');
    expect(result.instructContent).toBeDefined();
    expect(result.instructContent.isSuccess).toBe(true);
    
    // Verify that simulation was logged
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Simulation mode'));
  });

  it('should handle invalid response format gracefully', async () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: mockLLM,
      instruction: 'This will produce an error',
      taskType: 'ERROR_TASK'
    });
    
    // Spy on error logger to verify error handling
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Execute the task
    const result = await executeTask.run();
    
    // Verify error handling
    expect(result.status).toBe('failed');
    expect(result.content).toContain('This is an invalid response');
    
    // Verify task status is updated
    expect(executeTask['task']?.status).toBe('failed');
    
    // Verify that error was logged
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should handle task timeout correctly', async () => {
    // Mock setTimeout to trigger immediately
    vi.spyOn(window, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return 123 as any;
    });
    
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: mockLLM,
      instruction: 'This will timeout',
      taskType: 'TIMEOUT_TASK',
      timeout: 1  // 1 second timeout
    });
    
    // Spy on the handleException method
    const handleExceptionSpy = vi.spyOn(executeTask as any, 'handleException');
    
    // Execute the task
    const result = await executeTask.run();
    
    // Verify timeout handling
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Failed to execute task');
    
    // Verify that handleException was called
    expect(handleExceptionSpy).toHaveBeenCalled();
    
    // Verify task status is updated
    expect(executeTask['task']?.status).toBe('failed');
  });

  it('should parse task response correctly', () => {
    const executeTask = new ExecuteTask({
      name: 'ExecuteTask',
      description: 'Execute a task based on instructions',
      llm: mockLLM
    });
    
    // Test with JSON in code blocks
    const response1 = `Here's the solution:
\`\`\`json
{
  "code": "console.log('Hello world');",
  "result": "Successfully printed greeting",
  "isSuccess": true
}
\`\`\``;

    const parsed1 = (executeTask as any).parseTaskResponse(response1);
    expect(parsed1.code).toBe("console.log('Hello world');");
    expect(parsed1.result).toBe("Successfully printed greeting");
    expect(parsed1.isSuccess).toBe(true);
    
    // Test with JSON without code blocks
    const response2 = `{"code": "return 42;", "result": "Answer found", "isSuccess": true}`;
    const parsed2 = (executeTask as any).parseTaskResponse(response2);
    expect(parsed2.code).toBe("return 42;");
    expect(parsed2.result).toBe("Answer found");
    expect(parsed2.isSuccess).toBe(true);
  });
}); 