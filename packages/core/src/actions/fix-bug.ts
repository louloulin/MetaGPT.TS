import { z } from 'zod';
import { BaseAction } from './base-action';
import type { ActionConfig } from '../types/action';
import { logger } from '../utils/logger';
import { stringifyWithCircularRefs } from '../utils/json';
import type { Message } from '../types/message';

/**
 * Schema for the ActionNode type
 */
export const BugNodeSchema = z.object({
  key: z.string(),
  expectedType: z.any().optional(),
  instruction: z.string(),
  example: z.any()
});

export type BugNode = z.infer<typeof BugNodeSchema>;

/**
 * Action nodes for bug fixing process
 */
export const BUG_ANALYSIS: BugNode = {
  key: 'Bug Analysis',
  expectedType: z.string(),
  instruction: 'Analyze the bug description, error messages, stack traces, and code context to understand the root cause.',
  example: 'The bug occurs due to an uncaught null reference when the user data is not properly loaded.'
};

export const POSSIBLE_CAUSES: BugNode = {
  key: 'Possible Causes',
  expectedType: z.array(z.string()),
  instruction: 'List potential causes for the bug based on the analysis.',
  example: [
    'Missing null check before accessing user.profile property',
    'Race condition in data loading',
    'Incorrect promise handling in the fetch function'
  ]
};

export const REPRODUCTION_STEPS: BugNode = {
  key: 'Reproduction Steps',
  expectedType: z.array(z.string()),
  instruction: 'Provide clear steps to reproduce the bug.',
  example: [
    '1. Navigate to the user profile page without being logged in',
    '2. Click on the "Edit Profile" button',
    '3. Observe the error in the console'
  ]
};

export const FIX_STRATEGY: BugNode = {
  key: 'Fix Strategy',
  expectedType: z.string(),
  instruction: 'Describe the strategy for fixing the bug, including which files need to be modified and what changes are needed.',
  example: 'Add null checks for user.profile before accessing its properties and show a loading state while data is being fetched.'
};

export const CODE_CHANGES: BugNode = {
  key: 'Code Changes',
  expectedType: z.array(z.object({
    file: z.string(),
    changes: z.array(z.object({
      lineNumber: z.number().optional(),
      original: z.string().optional(),
      replacement: z.string()
    }))
  })),
  instruction: 'Specify the exact code changes needed to fix the bug, including file paths, line numbers, original code, and replacement code.',
  example: [
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
  ]
};

export const TEST_CASES: BugNode = {
  key: 'Test Cases',
  expectedType: z.array(z.object({
    description: z.string(),
    steps: z.array(z.string()),
    expectedResult: z.string()
  })),
  instruction: 'Provide test cases to verify the bug is fixed.',
  example: [
    {
      description: 'User profile handling with null data',
      steps: [
        'Navigate to profile page without being logged in',
        'Verify no error is thrown',
        'Verify "Guest" is displayed as the username'
      ],
      expectedResult: 'Page loads without errors and shows "Guest" as the default name'
    }
  ]
};

export const PREVENTION_STRATEGY: BugNode = {
  key: 'Prevention Strategy',
  expectedType: z.string(),
  instruction: 'Suggest strategies to prevent similar bugs in the future.',
  example: 'Implement stronger TypeScript typing for user data and add automated tests for edge cases such as null user data.'
};

export const ANYTHING_UNCLEAR_BUG: BugNode = {
  key: 'Anything UNCLEAR',
  expectedType: z.string(),
  instruction: 'Mention any unclear aspects about the bug or its context.',
  example: 'It\'s unclear whether this bug only affects the profile page or if similar null reference issues exist elsewhere in the app.'
};

export const BUG_NODES = [
  BUG_ANALYSIS,
  POSSIBLE_CAUSES,
  REPRODUCTION_STEPS,
  FIX_STRATEGY,
  CODE_CHANGES,
  TEST_CASES,
  PREVENTION_STRATEGY,
  ANYTHING_UNCLEAR_BUG
];

/**
 * Configuration for the FixBug action
 */
export interface FixBugConfig extends ActionConfig {
  /**
   * Optional bug details to provide context
   */
  bugDetails?: {
    description?: string;
    errorMessage?: string;
    stackTrace?: string;
    codeContext?: string;
  };
}

/**
 * FixBug Action
 * Analyzes and fixes bugs in code
 */
export class FixBug extends BaseAction {
  private nodes: BugNode[];
  private bugDetails: {
    description: string;
    errorMessage: string;
    stackTrace: string;
    codeContext: string;
  };

  /**
   * Creates a new FixBug action
   * 
   * @param config Optional configuration
   */
  constructor(config: FixBugConfig) {
    super({
      name: 'FixBug',
      description: 'Analyzes and fixes bugs in code',
      prefix: config.prefix,
      args: config.args,
      llm: config.llm,
      memory: config.memory,
      workingMemory: config.workingMemory
    });
    
    this.nodes = BUG_NODES;
    this.bugDetails = {
      description: config.bugDetails?.description || '',
      errorMessage: config.bugDetails?.errorMessage || '',
      stackTrace: config.bugDetails?.stackTrace || '',
      codeContext: config.bugDetails?.codeContext || ''
    };
    
    logger.debug(`FixBug initialized with ${this.nodes.length} nodes`);
  }

  /**
   * Runs the bug fixing action
   * 
   * @returns Action result with bug analysis and fix
   */
  async run(): Promise<{ status: 'created' | 'running' | 'completed' | 'failed' | 'blocked'; content: string; instructContent?: any }> {
    logger.info(`Running FixBug action`);
    
    try {
      const context = this.prepareBugContext();
      const result: Record<string, any> = {};
      
      // Execute each node to build the bug fixing plan
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
      logger.error(`Error in FixBug action: ${error}`);
      return {
        status: 'failed',
        content: `Failed to fix bug: ${error}`
      };
    }
  }

  /**
   * Prepares the bug context by combining bug details and any message context
   * 
   * @returns Combined bug context string
   */
  private prepareBugContext(): string {
    const messageContext = this.context?.args?.context?.toString() || '';
    const messageContent = this.context?.args?.message 
      ? (this.context.args.message as Message).content 
      : '';
    
    return `
Bug Description:
${this.bugDetails.description || messageContent || 'No description provided'}

Error Message:
${this.bugDetails.errorMessage || 'No error message provided'}

Stack Trace:
${this.bugDetails.stackTrace || 'No stack trace provided'}

Code Context:
${this.bugDetails.codeContext || 'No code context provided'}

Additional Context:
${messageContext}
`.trim();
  }

  /**
   * Executes a single action node
   * 
   * @param node The action node to execute
   * @param context The context for execution
   * @returns The result of the node execution
   */
  private async executeNode(node: BugNode, context: string): Promise<any> {
    logger.debug(`Executing bug fix node: ${node.key}`);
    
    const prompt = `
You are an expert TypeScript developer tasked with fixing a bug.

${node.instruction}

Bug Context:
${context}

Provide your response in the expected format. For reference, here's an example: ${stringifyWithCircularRefs(node.example, 2)}
`.trim();

    const content = await this.llm.generate(prompt);
    
    try {
      // Parse the result based on the expected type
      if (node.key === 'Bug Analysis' || node.key === 'Fix Strategy' || 
          node.key === 'Prevention Strategy' || node.key === 'Anything UNCLEAR') {
        // These nodes expect string results
        return content;
      } else {
        // All other nodes expect structured data
        return JSON.parse(content);
      }
    } catch (error) {
      logger.error(`Error parsing node ${node.key} result: ${error}`);
      return content; // Return as-is if parsing fails
    }
  }
} 