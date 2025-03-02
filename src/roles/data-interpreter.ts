import { v4 as uuidv4 } from 'uuid';
import { BaseRole } from './base-role';
import { ExecuteNbCode } from '../actions/di/execute-nb-code';
import { WriteAnalysisCode, CheckData } from '../actions/di/write-analysis-code';
import type { ActionConfig } from '../actions/di/write-analysis-code';
import type { Message } from '../types/message';
import type { LLMProvider } from '../types/llm';
import type { Action } from '../types/action';
import { BM25ToolRecommender } from '../tools/tool-recommend';
import type { ToolRecommender } from '../tools/tool-recommend';
import { ArrayMemory } from '../types/memory';
import type { Task, TaskResult } from '../types/task';
import { logger } from '../utils/logger';
import { AIMessage } from '../types/message';

/**
 * Run mode for data interpreter
 */
export enum RunMode {
  REGULAR = 'regular',
  STREAMING = 'streaming'
}

/**
 * Stream callback function type
 */
export type StreamCallback = (chunk: string, sectionTitle: string) => void;

/**
 * Stream options for data interpreter
 */
export interface StreamOptions {
  mode: RunMode;
  streamCallback?: StreamCallback;
}

/**
 * 思考提示词
 */
const REACT_THINK_PROMPT = `
# User Requirement
{user_requirement}
# Context
{context}

Output a json following the format:
\`\`\`json
{
    "thoughts": str = "Thoughts on current situation, reflect on how you should proceed to fulfill the user requirement",
    "state": bool = "Decide whether you need to take more actions to complete the user requirement. Return true if you think so. Return false if you think the requirement has been completely fulfilled."
}
\`\`\`
`;

/**
 * Configuration for DataInterpreter
 */
export interface DataInterpreterConfig {
  llm: LLMProvider;
  auto_run?: boolean;
  use_plan?: boolean;
  use_reflection?: boolean;
  tools?: string[];
  react_mode?: 'plan_and_act' | 'react';
  max_react_loop?: number;
  outputDir?: string;
}

/**
 * 数据解释器角色，用于数据分析和可视化
 */
export class DataInterpreter extends BaseRole {
  llm: LLMProvider;
  auto_run: boolean;
  use_plan: boolean;
  use_reflection: boolean;
  execute_code: ExecuteNbCode;
  tools: string[] = [];
  tool_recommender: any = null;
  react_mode: 'plan_and_act' | 'react';
  max_react_loop: number;
  planner: any = null; // This would be replaced with actual Planner type
  private outputDir: string;

  /**
   * 构造函数
   */
  constructor(config: DataInterpreterConfig) {
    super(
      'David',
      'DataInterpreter',
      'Analyze data and provide insights through code generation and execution',
      'Write clean, efficient, and well-documented code for data analysis',
      [new WriteAnalysisCode({ llm: config.llm })]
    );
    
    console.log('[DataInterpreter] Initializing with config:', {
      auto_run: config.auto_run ?? true,
      use_plan: config.use_plan ?? true,
      use_reflection: config.use_reflection ?? false,
      react_mode: config.react_mode ?? 'plan_and_act',
      max_react_loop: config.max_react_loop ?? 10,
      tools: config.tools?.length ?? 0,
    });
    
    this.llm = config.llm;
    this.auto_run = config.auto_run ?? true;
    this.use_plan = config.use_plan ?? true;
    this.use_reflection = config.use_reflection ?? false;
    this.execute_code = new ExecuteNbCode(this.llm);
    this.tools = config.tools ?? [];
    this.react_mode = config.react_mode ?? 'plan_and_act';
    this.max_react_loop = config.max_react_loop ?? 10;
    this.outputDir = config.outputDir || process.cwd();
    
    // Initialize tool recommender if tools are provided
    if (this.tools.length > 0) {
      this.tool_recommender = new BM25ToolRecommender(this.tools);
    }
    
    // Initialize role
    this.initialize();
  }
  
  /**
   * Initialize role
   */
  private initialize(): void {
    // Set react mode and working memory
    this.setReactMode(this.react_mode, this.max_react_loop);
    
    // Override use_plan based on react_mode for consistency
    this.use_plan = this.react_mode === 'plan_and_act';
    
    // Set initial state
    this.context.state = 0;
    this.setTodo(this.actions[0]);
  }
  
  /**
   * Set react mode
   */
  public setReactMode(mode: 'plan_and_act' | 'react' | 'by_order', maxReactLoop: number = 1): void {
    super.setReactMode(mode, maxReactLoop);
    this.react_mode = mode === 'by_order' ? 'plan_and_act' : mode;
    this.max_react_loop = maxReactLoop;
  }
  
  /**
   * 获取工作记忆
   */
  get working_memory(): ArrayMemory {
    return this.context.workingMemory;
  }
  
  /**
   * Create an error message
   */
  private createErrorMessage(error: Error, errorType: string): AIMessage {
    return new AIMessage(
      `Error: ${error.message}`,
      {
        importance: 1,
        tags: ["error", errorType],
        context: {
          errorType,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      }
    );
  }

  /**
   * Create an analysis message
   */
  private createAnalysisMessage(content: string, metadata: Record<string, any> = {}): AIMessage {
    return new AIMessage(
      content,
      {
        importance: 1,
        tags: ["analysis"],
        context: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      }
    );
  }

  /**
   * Handle LLM response
   */
  private async handleLLMResponse(response: string): Promise<[boolean, string]> {
    try {
      const parsedResponse = JSON.parse(response);
      
      // Add thoughts to working memory
      await this.addToWorkingMemory(this.createAnalysisMessage(
        parsedResponse.thoughts,
        {
          code: parsedResponse.code,
          insights: parsedResponse.insights
        }
      ));

      // Set context state and return next action status
      this.context.state = parsedResponse.next_action ? 0 : -1;
      return [parsedResponse.next_action, parsedResponse.thoughts];
    } catch (error) {
      console.error(`[${this.name}] Failed to parse LLM response:`, error);
      await this.addToWorkingMemory(this.createErrorMessage(
        error as Error,
        "PARSE_ERROR"
      ));
      return [false, ""];
    }
  }

  /**
   * Think about the next action based on the current context
   */
  public override async think(): Promise<boolean> {
    try {
      console.log(`[${this.name}] Thinking about next action...`);
      
      // Get messages from working memory
      const messages = await this.getMessages();
      if (!messages || messages.length === 0) {
        console.log(`[${this.name}] No messages in working memory`);
        return false;
      }

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage.content) {
        console.log(`[${this.name}] Last message has no content`);
        return false;
      }

      // Create prompt for LLM
      const prompt = `Based on the following requirement, please analyze the data and provide insights:
${lastMessage.content}

Please provide your response in the following JSON format:
{
  "thoughts": "your analysis process",
  "code": "the Python code to perform the analysis",
  "insights": "key findings and insights from the analysis",
  "next_action": "whether further analysis is needed (true/false)"
}`;

      try {
        // Get LLM response
        const llmResponse = await this.llm.generate(prompt);
        console.log(`[${this.name}] LLM Response:`, llmResponse);

        // Parse LLM response
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(llmResponse);
        } catch (parseError) {
          console.error(`[${this.name}] Failed to parse LLM response:`, parseError);
          await this.addToWorkingMemory(new AIMessage(
            "Error: Failed to parse analysis results. Please try again.",
            {
              importance: 1,
              tags: ["error", "parse_error"],
              context: {
                errorType: "PARSE_ERROR",
                timestamp: new Date().toISOString()
              }
            }
          ));
          return false;
        }

        // Add thoughts to working memory
        await this.addToWorkingMemory(new AIMessage(
          parsedResponse.thoughts,
          {
            importance: 1,
            tags: ["analysis", "code"],
            context: {
              code: parsedResponse.code,
              insights: parsedResponse.insights,
              timestamp: new Date().toISOString()
            }
          }
        ));

        // Set context state based on whether further action is needed
        this.context.state = parsedResponse.next_action ? 0 : -1;
        return parsedResponse.next_action;

      } catch (error) {
        const llmError = error as Error;
        console.error(`[${this.name}] LLM Error:`, llmError);
        await this.addToWorkingMemory(new AIMessage(
          "Error: Failed to generate analysis. Please try again.",
          {
            importance: 1,
            tags: ["error", "llm_error"],
            context: {
              errorType: "LLM_ERROR",
              errorMessage: llmError.message,
              timestamp: new Date().toISOString()
            }
          }
        ));
        return false;
      }
    } catch (error) {
      const unexpectedError = error as Error;
      console.error(`[${this.name}] Unexpected error:`, unexpectedError);
      await this.addToWorkingMemory(new AIMessage(
        "Error: An unexpected error occurred. Please try again.",
        {
          importance: 1,
          tags: ["error", "unexpected_error"],
          context: {
            errorType: "UNEXPECTED_ERROR",
            errorMessage: unexpectedError.message,
            timestamp: new Date().toISOString()
          }
        }
      ));
      return false;
    }
  }
  
  /**
   * 执行行动（React 模式下使用）
   */
  async act(): Promise<Message> {
    console.log('[DataInterpreter] Starting act method');
    
    const [code, result, isSuccess] = await this.writeAndExecCode();
    
    const message = this.createMessage(code);
    message.causedBy = 'WriteAnalysisCode';
    
    console.log('[DataInterpreter] Act completed, returning message');
    return message;
  }
  
  /**
   * 基于计划执行行动（plan_and_act 模式下使用）
   */
  async planAndAct(): Promise<Message> {
    console.log('[DataInterpreter] Starting planAndAct method');
    
    try {
      // This would be replaced with actual implementation
      // that interacts with a proper Planner class
      const message = await this.act();
      await this.execute_code.terminate();
      return message;
    } catch (error) {
      console.error('[DataInterpreter] Error in planAndAct:', error);
      await this.execute_code.terminate();
      throw error;
    }
  }
  
  /**
   * 执行特定任务（plan_and_act 模式下使用）
   */
  async actOnTask(task: Task): Promise<TaskResult> {
    console.log(`[DataInterpreter] Starting actOnTask with task: ${task.title}`);
    
    const [code, result, isSuccess] = await this.writeAndExecCode();
    
    const taskResult: TaskResult = {
      code: code,
      result: result,
      isSuccess: isSuccess
    };
    
    console.log(`[DataInterpreter] Task completed with success: ${isSuccess}`);
    return taskResult;
  }
  
  /**
   * 编写并执行代码
   */
  private async writeAndExecCode(maxRetry: number = 3): Promise<[string, string, boolean]> {
    console.log(`[DataInterpreter] Starting writeAndExecCode with max retries: ${maxRetry}`);
    
    let counter = 0;
    let success = false;
    let code = '';
    let result = '';
    
    // Prepare plan status
    const planStatus = this.use_plan && this.planner ? this.planner.get_plan_status() : '';
    
    // Prepare tool info
    let toolInfo = '';
    if (this.tool_recommender) {
      const messages = await this.working_memory?.get();
      const context = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
      const plan = this.use_plan && this.planner ? this.planner.plan : null;
      
      toolInfo = await this.tool_recommender.getRecommendedToolInfo(context, plan);
    }
    
    // Check data (in a full implementation, this would interact with actual data)
    await this.checkData();
    
    // Try to write and execute code, with retries
    while (!success && counter < maxRetry) {
      console.log(`[DataInterpreter] Code execution attempt ${counter + 1} of ${maxRetry}`);
      
      // Write code
      [code] = await this.writeCode();
      
      // Add code to working memory
      if (this.working_memory) {
        await this.addToWorkingMemory(this.createMessage(code));
      }
      
      // Execute code
      [result, success] = await this.execute_code.run(code);
      console.log(`Execution result: ${success ? 'Success' : 'Failed'}`);
      
      if (!success) {
        console.log(`[DataInterpreter] Code execution failed, retrying...`);
      }
      
      counter++;
    }
    
    return [code, result, success];
  }

  /**
   * Run the data interpreter with support for streaming
   */
  public async run(message: Message, options?: StreamOptions): Promise<Message> {
    try {
      // Add message to memory
      await this.addToMemory(message);

      if (options?.mode === RunMode.STREAMING) {
        return await this.runWithStreaming(options.streamCallback);
      } else {
        return await this.runRegular();
      }
    } catch (error) {
      logger.error(`[${this.name}] Error in run method: ${error}`);
      return this.createMessage('Cannot determine next action. Please try again.');
    }
  }

  /**
   * Run with streaming output
   */
  private async runWithStreaming(callback?: StreamCallback): Promise<Message> {
    const sections = ['Data Loading', 'Exploratory Analysis', 'Statistical Analysis', 'Visualization', 'Model Training'];
    let currentSection = '';
    let fullContent = '';
    
    // Store the original generate method
    const originalGenerate = this.llm.generate.bind(this.llm);

    try {
      const boundCallback = callback?.bind(this);
      
      // Create a wrapped generate function that maintains the original context
      this.llm.generate = async (prompt: string) => {
        const response = await originalGenerate(prompt);
        
        // Find current section
        for (const section of sections) {
          if (response.includes(section)) {
            currentSection = section;
            break;
          }
        }

        // Call streaming callback
        if (boundCallback) {
          boundCallback(response, currentSection);
        }

        fullContent += response;
        return response;
      };

      // Run the analysis
      const result = this.react_mode === 'react' 
        ? await this.react()
        : await this.planAndAct();

      // Restore original generate method
      this.llm.generate = originalGenerate;

      return result;
    } catch (error) {
      logger.error(`[${this.name}] Error in streaming analysis: ${error}`);
      // Restore original generate method in case of error
      this.llm.generate = originalGenerate;
      return this.createMessage('Error occurred during streaming analysis. Please try again.');
    }
  }

  /**
   * Run in regular mode
   */
  private async runRegular(): Promise<Message> {
    try {
      return this.react_mode === 'react'
        ? await this.react()
        : await this.planAndAct();
    } catch (error) {
      logger.error(`[${this.name}] Error in regular analysis: ${error}`);
      return this.createMessage('Error occurred during analysis. Please try again.');
    }
  }

  /**
   * Check data before analysis
   */
  private async checkData(): Promise<boolean> {
    const checkAction = new CheckData({ llm: this.llm });
    const result = await checkAction.run();
    return result.status === 'completed';
  }

  /**
   * Write analysis code
   */
  private async writeCode(): Promise<string> {
    const writeAction = new WriteAnalysisCode({ llm: this.llm });
    const result = await writeAction.run();
    return result.content;
  }

  /**
   * Create a message with proper timestamp and metadata
   */
  protected override createMessage(content: string, role: string = 'assistant'): Message {
    return {
      id: uuidv4(),
      content,
      role,
      causedBy: 'data-analysis',
      sentFrom: this.name,
      timestamp: new Date().toISOString(),
      sendTo: new Set(['*']),
      instructContent: null,
      metadata: {
        importance: 0.5,
        tags: ['data-analysis'],
        context: {}
      }
    };
  }

  /**
   * Override addToWorkingMemory to include metadata
   */
  protected override async addToWorkingMemory(message: Message): Promise<void> {
    const enhancedMessage = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
      metadata: {
        ...(message.metadata || {}),
        importance: 0.5,
        tags: ['data-analysis'],
        context: {}
      }
    };
    await super.addToWorkingMemory(enhancedMessage);
  }

  /**
   * Get messages from memory with proper typing
   */
  protected override async getMessages(): Promise<Message[]> {
    const messages = await super.getMessages();
    return messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp || new Date().toISOString(),
      metadata: {
        ...(msg.metadata || {}),
        importance: 0.5,
        tags: ['data-analysis'],
        context: {}
      }
    }));
  }

  /**
   * Execute in React mode
   */
  public override async react(): Promise<Message> {
    try {
      let needsMoreAction = true;
      let loopCount = 0;
      let lastMessage: Message | null = null;

      while (needsMoreAction && loopCount < this.max_react_loop) {
        // Think about what to do next
        needsMoreAction = await this.think();
        
        if (needsMoreAction) {
          // Execute the action
          lastMessage = await this.act();
        }
        loopCount++;
      }

      return lastMessage || this.createMessage('Analysis completed.');
    } catch (error) {
      logger.error(`[${this.name}] Error in react method: ${error}`);
      return this.createMessage('Error occurred during analysis. Please try again.');
    }
  }
}