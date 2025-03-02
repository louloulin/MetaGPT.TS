import { BaseRole } from './base-role';
import type { Message } from '../types/message';
import type { Action } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';

/**
 * Engineer Role
 * Responsible for implementing software based on requirements and designs
 */
export class Engineer extends BaseRole {
  // Add LLM property
  llm?: LLMProvider;
  private codeTodos: Action[] = [];
  private nextTodoAction: string = 'WriteCode';

  constructor(
    name: string = 'Engineer',
    llm?: LLMProvider,
    profile: string = 'Software Engineer',
    goal: string = 'Implement high-quality, maintainable code based on requirements and designs',
    constraints: string = 'Follow best practices and coding standards. Write clean, well-documented code.',
    actions: Action[] = []
  ) {
    super(name, profile, goal, constraints, actions);
    // Instead of directly assigning to desc which is read-only, we'll handle description differently
    this.llm = llm;
    
    // Initialize actions with the LLM if provided
    if (this.llm) {
      this.actions.forEach(action => {
        // Assign LLM to action if needed
        try {
          if (action.context) {
            action.context.llm = this.llm;
          }
        } catch (error) {
          logger.debug(`[${this.name}] Could not assign LLM to action: ${error}`);
        }
      });
    }
  }

  /**
   * Analyze a coding task and determine the best approach
   * @param message - Message containing the coding task
   * @returns Analysis result
   */
  async analyzeTask(message: Message): Promise<string> {
    logger.info(`[${this.name}] Analyzing task: ${message.content.substring(0, 100)}...`);
    
    // First check if we have a direct LLM available on the role
    if (this.llm) {
      const prompt = `
      As a software engineer, analyze the following task and provide a brief plan for implementation:
      
      TASK:
      ${message.content}
      
      Please include:
      1. Key components/modules needed
      2. Potential challenges
      3. Implementation approach
      4. Estimated complexity (Low/Medium/High)
      `;
      
      try {
        logger.info(`[${this.name}] Sending analysis prompt to LLM (stream mode)...`);
        
        // Check if chatStream is available and use it for streaming
        if (this.llm.chatStream) {
          let fullResponse = '';
          logger.info(`[${this.name}] Using stream mode for analysis...`);
          
          // Use chatStream to get streaming responses
          for await (const chunk of this.llm.chatStream(prompt)) {
            process.stdout.write(chunk); // Display chunks in real-time
            fullResponse += chunk;
          }
          console.log(); // Add newline after streaming finishes
          
          return fullResponse;
        } else {
          // Fallback to regular chat if streaming not available
          logger.info(`[${this.name}] Stream mode not available, using regular chat...`);
          return await this.llm.chat(prompt);
        }
      } catch (error) {
        logger.error(`[${this.name}] Error analyzing task with role LLM:`, error);
      }
    }
    
    // Fallback to action's LLM if available
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a software engineer, analyze the following task and provide a brief plan for implementation:
      
      TASK:
      ${message.content}
      
      Please include:
      1. Key components/modules needed
      2. Potential challenges
      3. Implementation approach
      4. Estimated complexity (Low/Medium/High)
      `;
      
      try {
        logger.info(`[${this.name}] Sending analysis prompt to action's LLM...`);
        
        // Try to use chatStream if available
        if (llm.chatStream) {
          let fullResponse = '';
          logger.info(`[${this.name}] Using stream mode for analysis with action's LLM...`);
          
          // Use chatStream to get streaming responses
          for await (const chunk of llm.chatStream(prompt)) {
            process.stdout.write(chunk); // Display chunks in real-time
            fullResponse += chunk;
          }
          console.log(); // Add newline after streaming finishes
          
          return fullResponse;
        } else {
          // Fallback to regular chat
          return await llm.chat(prompt);
        }
      } catch (error) {
        logger.error(`[${this.name}] Error analyzing task with action LLM:`, error);
        return `Failed to analyze task: ${error}`;
      }
    }
    
    // Fallback if no LLM is available
    return "Task analysis requires an LLM provider. Please configure one.";
  }

  /**
   * Set the next action to be executed
   */
  protected setTodo(action: Action): void {
    this.codeTodos = [action, ...this.codeTodos];
    this.nextTodoAction = action.name;
  }

  /**
   * Process a writing code request
   */
  private async processWriteCodeRequest(action: Action): Promise<Message> {
    logger.info(`[${this.name}] Running ${action.name} action`);
    
    try {
      // Check if the action has requirements in its args
      const actionWithArgs = action as any;
      if (actionWithArgs.args && actionWithArgs.args.requirements) {
        logger.info(`[${this.name}] Processing requirements: ${String(actionWithArgs.args.requirements).substring(0, 100)}...`);
      } else if (actionWithArgs.args && actionWithArgs.args.language) {
        logger.info(`[${this.name}] Target language: ${actionWithArgs.args.language}`);
      }
      
      // Set timeout for the action
      const timeoutPromise = new Promise<{status: string, content: string}>((_, reject) => {
        setTimeout(() => reject(new Error('WriteCode action timed out after 60 seconds')), 60000);
      });
      
      // Run the action with timeout
      logger.info(`[${this.name}] Executing ${action.name} action...`);
      const resultPromise = action.run();
      
      let result;
      try {
        result = await Promise.race([resultPromise, timeoutPromise]);
      } catch (error) {
        logger.error(`[${this.name}] Timeout or error executing ${action.name}:`, error);
        // If timeout, we still try to continue with the original promise
        result = await resultPromise;
      }
      
      if (result.status === 'completed') {
        logger.info(`[${this.name}] Successfully completed ${action.name}`);
        return this.createMessage(result.content);
      } else {
        logger.error(`[${this.name}] Failed to execute ${action.name}: ${result.content}`);
        return this.createMessage(`Failed to execute ${action.name}: ${result.content}`);
      }
    } catch (error) {
      logger.error(`[${this.name}] Error executing ${action.name}:`, error);
      return this.createMessage(`Error executing ${action.name}: ${error}`);
    }
  }

  /**
   * Override the decideNextAction method to implement custom logic
   */
  protected async decideNextAction(message?: Message): Promise<Action | null> {
    // If we have explicit todo actions, prioritize them
    if (this.codeTodos.length > 0) {
      const nextAction = this.codeTodos[0];
      this.codeTodos = this.codeTodos.slice(1);
      return nextAction;
    }
    
    // If we have a message about coding, prioritize coding actions
    if (message && message.content.toLowerCase().includes('code') && this.actions.length > 0) {
      // Find actions related to coding
      const codingActions = this.actions.filter(action => 
        action.name.toLowerCase().includes('code') || 
        action.name.toLowerCase().includes('implement')
      );
      
      if (codingActions.length > 0) {
        return codingActions[0];
      }
    }
    
    // Default to parent implementation
    return await super.decideNextAction(message);
  }

  /**
   * Override the react method to add engineering-specific behavior
   */
  async react(message?: Message): Promise<Message> {
    if (message) {
      // If the message is a coding task, analyze it first
      if (message.content.toLowerCase().includes('implement') || 
          message.content.toLowerCase().includes('code') ||
          message.content.toLowerCase().includes('develop')) {
        
        const analysis = await this.analyzeTask(message);
        
        // Add the analysis to memory
        const analysisMessage = this.createMessage(
          `Task Analysis:\n${analysis}`
        );
        this.addToMemory(analysisMessage);
      }
      
      // Check if the message contains requirements for a WriteCode action
      for (const action of this.actions) {
        if (action.name.toLowerCase().includes('code')) {
          // Set this action as the next todo
          this.setTodo(action);
          return await this.processWriteCodeRequest(action);
        }
      }
    }
    
    // Continue with the standard reaction process
    return super.react(message);
  }
  
  /**
   * Get the action description (for display)
   */
  public getActionDescription(): string {
    return this.nextTodoAction;
  }
} 