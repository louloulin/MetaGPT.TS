import { BaseRole } from './base-role';
import type { ActionOutput } from '../types/action';
import type { RoleContext } from '../types/role';
import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';
import type { Message } from '../types/message';
import type { CodeTask } from '../utils/code-todos';
import { CodeTodoManager, TaskPriority, TaskStatus } from '../utils/code-todos';
import { ChainOfThoughtBuilder } from '../utils/chain-of-thought';
import { v4 as uuidv4 } from 'uuid';

/**
 * Engineer role for implementing coding tasks
 */
export class Engineer extends BaseRole {
  /** LLM provider */
  private llm?: LLMProvider;
  /** Code todo manager for tracking task progress */
  private codeTodoManager: CodeTodoManager;
  /** Chain of thought builder for structured reasoning */
  private reasoningEngine: ChainOfThoughtBuilder;
  /** ID of the current task being processed */
  private currentTaskId?: string;
  /** Handler for the next todo task */
  private nextTodoAction?: () => Promise<ActionOutput>;
  
  /**
   * Create a new Engineer role
   */
  constructor(name: string = 'Engineer', profile: string = 'Software engineer', goal: string = 'Implement code', llm?: LLMProvider) {
    super(
      name,
      profile,
      goal,
      'Write maintainable, well-documented code. Follow best practices and patterns. Ensure proper error handling.'
    );
    
    this.llm = llm;
    this.codeTodoManager = new CodeTodoManager();
    // Initialize with empty values - will be set properly when analyzing tasks
    this.reasoningEngine = new ChainOfThoughtBuilder('', '', llm);
    
    if (llm) {
      // Initialize actions with the LLM
      this.initActions(llm);
    }
  }
  
  /**
   * Initialize Engineer actions
   */
  private initActions(llm: LLMProvider): void {
    // We'll add specific actions here as needed
  }
  
  /**
   * Set the LLM provider
   */
  setLLM(llm: LLMProvider): void {
    this.llm = llm;
    this.initActions(llm);
    this.reasoningEngine.setLLM(llm);
  }
  
  /**
   * Analyze a coding task using the LLM
   * This breaks down the task into manageable components and creates a code todo list
   */
  async analyzeTask(prompt: string): Promise<ActionOutput> {
    if (!this.llm) {
      throw new Error('Engineer requires an LLM to analyze tasks');
    }
    
    logger.info('Engineer is analyzing task...');
    
    try {
      // Create a new reasoning engine instance for this task
      this.reasoningEngine = new ChainOfThoughtBuilder(
        prompt,
        'Analyze this coding task and break it down into a structured implementation plan.',
        this.llm
      );
      
      // Generate steps in the reasoning process
      await this.reasoningEngine.generateStep("Let's understand the requirements in detail.");
      await this.reasoningEngine.generateStep("What are the main components or modules needed?");
      await this.reasoningEngine.generateStep("What dependencies and technologies should be used?");
      await this.reasoningEngine.generateStep("What is the data flow through the system?");
      await this.reasoningEngine.generateStep("How should we structure the code and organize the functionality?");
      
      // Generate the implementation plan based on the analysis
      const plan = await this.reasoningEngine.generateSolution();
      
      // Parse the plan into a code todo list
      const todoListId = await this.createTodoListFromPlan(plan);
      
      // Select this list as the current one
      this.codeTodoManager.selectList(todoListId);
      
      // Set up the next action to work on the first task
      this.setupNextTask();
      
      // Generate a markdown report of the plan
      const report = this.codeTodoManager.generateMarkdownReport();
      
      // Return the analysis result
      return {
        content: report,
        status: 'completed'
      };
    } catch (error) {
      logger.error('Error during task analysis:', error);
      
      return {
        content: `Failed to analyze task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'failed'
      };
    }
  }
  
  /**
   * Parse a structured plan into a code todo list
   */
  private async createTodoListFromPlan(plan: string): Promise<string> {
    // Create a new todo list
    const todoListId = this.codeTodoManager.createList(
      `Implementation Plan ${new Date().toISOString().slice(0, 10)}`,
      'Generated from task analysis'
    );
    
    // Parse the plan to extract tasks
    // This is a simplified approach - in a production system, we'd use more robust parsing
    const taskSections = plan.split(/##\s+(?:Step|Task)\s*\d+:?\s*/).filter(Boolean);
    
    for (let i = 0; i < taskSections.length; i++) {
      const section = taskSections[i].trim();
      if (!section) continue;
      
      // Extract title (first line)
      const titleMatch = section.match(/^(.+?)(?:\r?\n|$)/);
      const title = titleMatch ? titleMatch[1].trim() : `Task ${i + 1}`;
      
      // Extract complexity
      let complexity = 5; // Medium by default
      let priority = TaskPriority.MEDIUM;
      
      const complexityMatch = section.match(/complexity:?\s*(simple|medium|complex)/i);
      if (complexityMatch) {
        const complexityLevel = complexityMatch[1].toLowerCase();
        complexity = complexityLevel === 'simple' ? 3 : complexityLevel === 'complex' ? 8 : 5;
        priority = complexityLevel === 'simple' ? TaskPriority.LOW : 
                 complexityLevel === 'complex' ? TaskPriority.HIGH : TaskPriority.MEDIUM;
      }
      
      // Extract files
      const files: string[] = [];
      const fileMatches = section.match(/files?:?\s*([^,\n]+(?:,\s*[^,\n]+)*)/i);
      if (fileMatches) {
        const filesList = fileMatches[1].split(',').map(f => f.trim());
        files.push(...filesList);
      }
      
      // Extract dependencies
      const dependencies: string[] = [];
      // We'll handle dependencies later - need task IDs first
      
      // Add the task
      this.codeTodoManager.addTask({
        title,
        description: section,
        priority,
        complexity,
        files,
        dependencies,
        tags: [] // Add empty tags array to satisfy type requirements
      });
    }
    
    return todoListId;
  }
  
  /**
   * Set up the action to handle the next task
   */
  private setupNextTask(): void {
    const nextTask = this.codeTodoManager.getNextTask();
    
    if (nextTask) {
      this.currentTaskId = nextTask.id;
      this.nextTodoAction = async () => await this.implementTask(nextTask);
    } else {
      this.currentTaskId = undefined;
      this.nextTodoAction = undefined;
    }
  }
  
  /**
   * Implement a specific task using chain-of-thought reasoning
   */
  private async implementTask(task: CodeTask): Promise<ActionOutput> {
    if (!this.llm) {
      throw new Error('Engineer requires an LLM to implement tasks');
    }
    
    logger.info(`Engineer is implementing task: ${task.title}`);
    
    try {
      // Update task status
      this.codeTodoManager.setTaskStatus(task.id, TaskStatus.IN_PROGRESS);
      
      // Create a new reasoning engine instance for this implementation task
      this.reasoningEngine = new ChainOfThoughtBuilder(
        `Implement: ${task.title}`,
        `Task Description: ${task.description}\n${task.files.length > 0 ? `Files to modify: ${task.files.join(', ')}` : ''}`,
        this.llm
      );
      
      // Generate steps in the reasoning process
      await this.reasoningEngine.generateStep("Let's understand what the code needs to do.");
      await this.reasoningEngine.generateStep("What edge cases and error conditions need to be handled?");
      await this.reasoningEngine.generateStep("What is the most efficient and maintainable approach?");
      await this.reasoningEngine.generateStep("How should the code be structured and organized?");
      
      // Generate the implementation code
      const implementation = await this.reasoningEngine.generateSolution();
      
      // Update the task with the solution
      this.codeTodoManager.updateTask(task.id, {
        status: TaskStatus.COMPLETED,
        solution: implementation
      });
      
      // Set up the next task
      this.setupNextTask();
      
      // Return the implementation
      return {
        content: implementation,
        status: 'completed'
      };
    } catch (error) {
      logger.error(`Error implementing task ${task.title}:`, error);
      
      // Mark task as blocked
      this.codeTodoManager.setTaskStatus(task.id, TaskStatus.BLOCKED);
      
      return {
        content: `Failed to implement task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'failed'
      };
    }
  }
  
  /**
   * Process the next action
   * Override the run method to implement custom behavior for the Engineer role
   */
  async run(message?: Message): Promise<Message> {
    // If we have a specific todo action to run, execute it
    if (this.nextTodoAction) {
      const result = await this.nextTodoAction();
      return this.createMessage(result.content);
    }
    
    // If we received a message, analyze it as a new task
    if (message) {
      const result = await this.analyzeTask(message.content);
      return this.createMessage(result.content);
    }
    
    return this.createMessage('No task to implement. Please provide a task description.');
  }
  
  /**
   * Create a new message from the Engineer role
   */
  protected createMessage(content: string): Message {
    return {
      id: uuidv4(),
      content,
      role: this.name,
      causedBy: 'Engineer.run',
      sentFrom: this.name,
      timestamp: new Date().toISOString(),
      sendTo: new Set([])
    };
  }
  
  /**
   * Get the current code todo list as markdown
   */
  getTodoListAsMarkdown(): string {
    return this.codeTodoManager.generateMarkdownReport();
  }
  
  /**
   * Get the current reasoning chain as markdown
   */
  getReasoningChainAsMarkdown(): string {
    return this.reasoningEngine.toMarkdown();
  }
  
  /**
   * Get the visualization of the task dependency graph
   */
  getTaskDependencyGraph(): string {
    return this.codeTodoManager.generateTaskGraph();
  }
} 