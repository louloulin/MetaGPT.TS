import { z } from 'zod';
import { BaseAction } from './base-action';
import type { ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Schema for the ActionNode type
 */
export const ActionNodeSchema = z.object({
  key: z.string(),
  expectedType: z.any().optional(),
  instruction: z.string(),
  example: z.any()
});

export type ActionNode = z.infer<typeof ActionNodeSchema>;

/**
 * Action nodes for project management
 */
export const REQUIRED_PACKAGES: ActionNode = {
  key: 'Required packages',
  expectedType: z.array(z.string()).optional(),
  instruction: 'Provide required third-party packages in package.json format.',
  example: ['express@4.17.1', 'bcrypt@5.0.1']
};

export const REQUIRED_OTHER_LANGUAGE_PACKAGES: ActionNode = {
  key: 'Required Other language third-party packages',
  expectedType: z.array(z.string()),
  instruction: 'List down the required packages for languages other than TypeScript/JavaScript.',
  example: ['No third-party dependencies required']
};

export const LOGIC_ANALYSIS: ActionNode = {
  key: 'Logic Analysis',
  expectedType: z.array(z.array(z.string())),
  instruction: 'Provide a list of files with the classes/methods/functions to be implemented, including dependency analysis and imports.',
  example: [
    ['game.ts', 'Contains Game class and ... functions'],
    ['main.ts', 'Contains main function, imports Game from game.ts']
  ]
};

export const REFINED_LOGIC_ANALYSIS: ActionNode = {
  key: 'Refined Logic Analysis',
  expectedType: z.array(z.array(z.string())),
  instruction: 'Review and refine the logic analysis by merging the Legacy Content and Incremental Content. ' +
    'Provide a comprehensive list of files with classes/methods/functions to be implemented or modified incrementally. ' +
    'Include dependency analysis, consider potential impacts on existing code, and document necessary imports.',
  example: [
    ['game.ts', 'Contains Game class and ... functions'],
    ['main.ts', 'Contains main function, imports Game from game.ts'],
    ['new-feature.ts', 'Introduces NewFeature class and related functions'],
    ['utils.ts', 'Modifies existing utility functions to support incremental changes']
  ]
};

export const TASK_LIST: ActionNode = {
  key: 'Task list',
  expectedType: z.array(z.string()),
  instruction: 'Break down the tasks into a list of filenames, prioritized by dependency order.',
  example: ['game.ts', 'main.ts']
};

export const REFINED_TASK_LIST: ActionNode = {
  key: 'Refined Task list',
  expectedType: z.array(z.string()),
  instruction: 'Review and refine the combined task list after the merger of Legacy Content and Incremental Content, ' +
    'and consistent with Refined File List. Ensure that tasks are organized in a logical and prioritized order, ' +
    'considering dependencies for a streamlined and efficient development process.',
  example: ['new-feature.ts', 'utils.ts', 'game.ts', 'main.ts']
};

export const FULL_API_SPEC: ActionNode = {
  key: 'Full API spec',
  expectedType: z.string(),
  instruction: 'Describe all APIs using OpenAPI 3.0 spec that may be used by both frontend and backend. If front-end ' +
    'and back-end communication is not required, leave it blank.',
  example: 'openapi: 3.0.0 ...'
};

export const SHARED_KNOWLEDGE: ActionNode = {
  key: 'Shared Knowledge',
  expectedType: z.string(),
  instruction: 'Detail any shared knowledge, like common utility functions or configuration variables.',
  example: '`game.ts` contains functions shared across the project.'
};

export const REFINED_SHARED_KNOWLEDGE: ActionNode = {
  key: 'Refined Shared Knowledge',
  expectedType: z.string(),
  instruction: 'Update and expand shared knowledge to reflect any new elements introduced. This includes common ' +
    'utility functions, configuration variables for team collaboration. Retain content that is not related to ' +
    'incremental development but important for consistency and clarity.',
  example: '`new-module.ts` enhances shared utility functions for improved code reusability and collaboration.'
};

export const ANYTHING_UNCLEAR_PM: ActionNode = {
  key: 'Anything UNCLEAR',
  expectedType: z.string(),
  instruction: 'Mention any unclear aspects in the project management context and try to clarify them.',
  example: 'Clarification needed on how to start and initialize third-party libraries.'
};

export const NODES = [
  REQUIRED_PACKAGES,
  REQUIRED_OTHER_LANGUAGE_PACKAGES,
  LOGIC_ANALYSIS,
  TASK_LIST,
  FULL_API_SPEC,
  SHARED_KNOWLEDGE,
  ANYTHING_UNCLEAR_PM
];

export const REFINED_NODES = [
  REQUIRED_PACKAGES,
  REQUIRED_OTHER_LANGUAGE_PACKAGES,
  REFINED_LOGIC_ANALYSIS,
  REFINED_TASK_LIST,
  FULL_API_SPEC,
  REFINED_SHARED_KNOWLEDGE,
  ANYTHING_UNCLEAR_PM
];

/**
 * Configuration for the ProjectManagement action
 */
export interface ProjectManagementConfig extends ActionConfig {
  /**
   * Whether to use refined nodes for incremental development
   */
  isRefined?: boolean;
}

/**
 * Project Management Action
 * Responsible for managing project tasks, dependencies, and resources
 */
export class ProjectManagement extends BaseAction {
  private nodes: ActionNode[];
  private isRefined: boolean;

  /**
   * Creates a new ProjectManagement action
   * 
   * @param config Optional configuration
   */
  constructor(config: ProjectManagementConfig) {
    super({
      name: 'ProjectManagement',
      description: 'Manages project tasks, dependencies, and resources',
      prefix: config.prefix,
      args: config.args,
      llm: config.llm,
      memory: config.memory,
      workingMemory: config.workingMemory
    });
    
    this.isRefined = config.isRefined || false;
    this.nodes = this.isRefined ? REFINED_NODES : NODES;
    logger.debug(`ProjectManagement initialized with ${this.nodes.length} nodes`);
  }

  /**
   * Runs the project management action
   * 
   * @returns Action result with project management plan
   */
  async run(): Promise<{ status: 'created' | 'running' | 'completed' | 'failed' | 'blocked'; content: string; instructContent?: any }> {
    logger.info(`Running ProjectManagement action`);
    
    try {
      const context = this.context?.args?.context?.toString() || '';
      const result: Record<string, any> = {};
      
      // Execute each node to build the project management plan
      for (const node of this.nodes) {
        const nodeResult = await this.executeNode(node, context);
        result[node.key] = nodeResult;
      }
      
      return {
        status: 'completed',
        content: JSON.stringify(result),
        instructContent: result
      };
    } catch (error) {
      logger.error(`Error in ProjectManagement action: ${error}`);
      return {
        status: 'failed',
        content: `Failed to complete project management: ${error}`
      };
    }
  }

  /**
   * Executes a single action node
   * 
   * @param node The action node to execute
   * @param context The context for execution
   * @returns The result of the node execution
   */
  private async executeNode(node: ActionNode, context: string): Promise<any> {
    logger.debug(`Executing node: ${node.key}`);
    
    // Here we would typically use an LLM to generate the content for each node
    // based on the instruction and expected type
    
    const prompt = `${node.instruction}\n\nContext:\n${context}\n\nProvide your response in the expected format. For reference, here's an example: ${JSON.stringify(node.example)}`;
    const content = await this.llm.generate(prompt);
    
    try {
      // Parse the result based on the expected type
      // This is a simplified version; in a real implementation, 
      // we would need more robust parsing based on the expectedType
      if (Array.isArray(node.example)) {
        if (Array.isArray(node.example[0])) {
          // It's a 2D array
          return JSON.parse(content);
        } else {
          // It's a 1D array
          return JSON.parse(content);
        }
      } else if (typeof node.example === 'string') {
        return content;
      } else {
        return JSON.parse(content);
      }
    } catch (error) {
      logger.error(`Error parsing node ${node.key} result: ${error}`);
      return content; // Return as-is if parsing fails
    }
  }
} 