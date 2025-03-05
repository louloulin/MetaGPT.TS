import { BaseAction } from './base-action';
import type { ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Template for implementing Action subclasses
 * This serves as a reference for creating new actions
 */
export class ActionTemplate extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      // Always provide default name and description
      name: config.name || 'ActionTemplate',
      description: config.description || 'Template for action implementation'
    });
  }

  /**
   * Required: Implement the prompt method
   * This method should:
   * 1. Get and validate all required arguments
   * 2. Throw errors for missing required arguments
   * 3. Return a well-structured prompt string
   */
  protected async prompt(): Promise<string> {
    // 1. Get arguments with type safety
    const requiredArg = this.getArg<string>('required_arg');
    const optionalArg = this.getArg<string>('optional_arg') || 'default value';
    const complexArg = this.getArg<Record<string, any>>('complex_arg') || {};
    
    // 2. Validate required arguments
    if (!requiredArg) {
      throw new Error('Required argument is missing');
    }
    
    // 3. Build and return the prompt
    return `Your prompt template here:
Required: ${requiredArg}
Optional: ${optionalArg}
Complex: ${JSON.stringify(complexArg, null, 2)}

Instructions for the LLM:
1. First instruction
2. Second instruction
3. Third instruction

Additional context or requirements:
- Point 1
- Point 2
- Point 3

Expected output format:
[Format description here]`;
  }

  /**
   * Optional: Override toString for better logging
   * Useful for debugging and monitoring
   */
  toString(): string {
    return `${this.name}(${this.desc || 'No description'})`;
  }
}

/**
 * Example usage:
 * 
 * ```typescript
 * const action = new ActionTemplate({
 *   llm: someLLMProvider,
 *   description: 'Custom description'
 * });
 * 
 * // Regular mode
 * const result = await action.run({
 *   args: {
 *     required_arg: 'value',
 *     optional_arg: 'value',
 *     complex_arg: { key: 'value' }
 *   }
 * });
 * 
 * // Streaming mode
 * const streamResult = await action.run({
 *   mode: ActionRunMode.STREAMING,
 *   streamCallback: (chunk) => console.log(chunk),
 *   args: {
 *     required_arg: 'value'
 *   }
 * });
 * ```
 */