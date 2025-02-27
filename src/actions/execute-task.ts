/**
 * Execute Task Action
 * 
 * This action executes a given task based on the provided instructions.
 * It can handle various types of tasks, executing them and returning results.
 */

import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import type { Task, TaskResult } from '../types/task';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Schema for validating task execution results
const TaskExecutionResultSchema = z.object({
  code: z.string().optional(),
  result: z.string(),
  isSuccess: z.boolean()
});

/**
 * Configuration for ExecuteTask action
 */
export interface ExecuteTaskConfig extends ActionConfig {
  /**
   * The task to execute
   */
  task?: Task;
  
  /**
   * Task instruction if no task object is provided
   */
  instruction?: string;
  
  /**
   * Task type for categorizing the task
   */
  taskType?: string;
  
  /**
   * Execution timeout in seconds
   */
  timeout?: number;
  
  /**
   * Whether to simulate execution (for testing)
   */
  simulate?: boolean;
}

/**
 * ExecuteTask Action: Executes a task based on instructions
 */
export class ExecuteTask extends BaseAction {
  private config: ExecuteTaskConfig;
  private task: Task | null = null;

  /**
   * Creates a new ExecuteTask action
   * @param config Action configuration
   */
  constructor(config: ExecuteTaskConfig) {
    super({
      name: 'ExecuteTask',
      description: 'Execute a task based on provided instructions',
      prefix: config.prefix,
      args: config.args,
      llm: config.llm,
      memory: config.memory,
      workingMemory: config.workingMemory
    });
    
    this.config = config;
    
    // Initialize task if provided in config
    if (config.task) {
      this.task = config.task;
    } else if (config.instruction) {
      // Create a task from instruction
      this.task = {
        id: `task-${Date.now()}`,
        title: 'Generated Task',
        description: config.instruction,
        task_type: config.taskType || 'GENERAL',
        status: 'pending'
      };
    }
    
    logger.debug(`ExecuteTask initialized with task: ${this.task?.title || 'None'}`);
  }

  /**
   * Execute the task
   * @returns Result of task execution
   */
  async run(): Promise<ActionOutput> {
    try {
      logger.info(`Running ExecuteTask for: ${this.task?.title || 'Unknown task'}`);
      
      // Get the task instruction
      const instruction = this.task?.description || this.getArg<string>('instruction') || '';
      
      if (!instruction) {
        return this.createOutput(
          'No task instruction provided',
          'failed'
        );
      }
      
      // Check if simulation mode is enabled
      if (this.config.simulate) {
        logger.info(`Simulation mode: not actually executing task`);
        return this.createOutput(
          `[Simulation] Task would execute: ${instruction}`,
          'completed',
          {
            code: '// Simulated execution',
            result: 'Task simulated successfully',
            isSuccess: true
          }
        );
      }
      
      // Execute the task using LLM
      const taskResult = await this.executeTask(instruction);
      
      // Update task status
      if (this.task) {
        this.task.status = taskResult.isSuccess ? 'completed' : 'failed';
      }
      
      // Return the execution result
      return this.createOutput(
        taskResult.result,
        taskResult.isSuccess ? 'completed' : 'failed',
        taskResult
      );
    } catch (error) {
      logger.error(`Error in ExecuteTask action: ${error}`);
      await this.handleException(error as Error);
      
      // Update task status on error
      if (this.task) {
        this.task.status = 'failed';
      }
      
      return this.createOutput(
        `Failed to execute task: ${error}`,
        'failed'
      );
    }
  }
  
  /**
   * Execute the task using LLM
   * @param instruction Task instruction
   * @returns Task execution result
   */
  private async executeTask(instruction: string): Promise<TaskResult> {
    try {
      // Create the prompt for the LLM
      const prompt = this.createTaskPrompt(instruction);
      
      // Set timeout if specified
      const timeout = this.config.timeout || 60; // Default timeout: 60 seconds
      
      // Use Promise.race to implement timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Task execution timed out after ${timeout} seconds`)), timeout * 1000);
      });
      
      // Ask the LLM to execute the task
      const executionPromise = this.ask(prompt);
      const response = await Promise.race([executionPromise, timeoutPromise]);
      
      // Parse the LLM response
      return this.parseTaskResponse(response);
    } catch (error) {
      logger.error(`Task execution error: ${error}`);
      return {
        code: '',
        result: `Error executing task: ${error}`,
        isSuccess: false
      };
    }
  }
  
  /**
   * Create the prompt for task execution
   * @param instruction Task instruction
   * @returns Formatted prompt
   */
  private createTaskPrompt(instruction: string): string {
    const taskType = this.task?.task_type || this.config.taskType || 'GENERAL';
    
    return `
# Task Execution
## Type: ${taskType}
## Instruction:
${instruction}

## Task Requirements:
1. Carefully analyze the instruction and determine the best approach to execute this task.
2. If the task involves generating code, ensure it's correct, efficient, and well-documented.
3. Provide a detailed explanation of your solution and the steps taken.
4. Include any relevant output, results, or conclusions.

## Response Format:
Provide your response in the following JSON format:
\`\`\`json
{
  "code": "Your code implementation if applicable",
  "result": "Detailed explanation of your solution, approach, and results",
  "isSuccess": true/false
}
\`\`\`
`;
  }
  
  /**
   * Parse the LLM response
   * @param response Raw LLM response
   * @returns Parsed task result
   */
  private parseTaskResponse(response: string): TaskResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/{[\s\S]*}/);
      
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }
      
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      // Validate the parsed response
      const result = TaskExecutionResultSchema.safeParse(parsed);
      
      if (!result.success) {
        throw new Error(`Invalid response format: ${result.error}`);
      }
      
      return {
        code: result.data.code || '',
        result: result.data.result,
        isSuccess: result.data.isSuccess
      };
    } catch (error) {
      logger.error(`Error parsing task response: ${error}`, { response });
      
      // Fall back to using the raw response
      return {
        code: '',
        result: `Failed to parse response: ${response.substring(0, 200)}...`,
        isSuccess: false
      };
    }
  }
} 