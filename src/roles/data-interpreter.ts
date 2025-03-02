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
import type { DependencyManager, DependencyManagerConfig } from '../actions/dependency-manager/dependency-manager';
import { DependencyManagerFactory } from '../actions/dependency-manager/dependency-manager-factory';
import type { SupportedLanguage } from '../actions/dependency-manager/dependency-manager-factory';

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
 * 依赖管理配置
 */
export interface DependencyManagementConfig {
  /** 是否启用依赖管理 */
  enabled: boolean;
  /** 是否自动安装缺失的依赖 */
  autoInstall: boolean;
  /** 指定语言类型，如果不指定则自动检测 */
  language?: SupportedLanguage;
  /** 依赖管理器的配置 */
  config?: DependencyManagerConfig;
}

export interface DataInterpreterConfig {
  /** LLM提供者 */
  llm: LLMProvider;
  /** 是否自动运行 */
  auto_run?: boolean;
  /** 是否使用计划 */
  use_plan?: boolean;
  /** 是否使用反思 */
  use_reflection?: boolean;
  /** 反应模式 */
  react_mode?: 'plan_and_act' | 'react';
  /** 最大反应循环 */
  max_react_loop?: number;
  /** 输出目录 */
  outputDir?: string;
  /** 可用工具列表 */
  tools?: any[];
  /** 依赖管理配置 */
  dependencyManagement?: DependencyManagementConfig;
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
  private dependencyManager: DependencyManager | null = null;
  private useAutoLanguageDetection = true;
  private config: DataInterpreterConfig;
  private filename: string = '';

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
    
    this.config = config;
    
    console.log('[DataInterpreter] Initializing with config:', {
      auto_run: config.auto_run ?? true,
      use_plan: config.use_plan ?? true,
      use_reflection: config.use_reflection ?? false,
      react_mode: config.react_mode ?? 'plan_and_act',
      max_react_loop: config.max_react_loop ?? 10,
      tools: config.tools?.length ?? 0,
      dependencyManagement: config.dependencyManagement?.enabled ? 'enabled' : 'disabled',
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
    
    // Initialize dependency manager if enabled
    this.initDependencyManager();
    
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
    logger.info(`[${this.name}] Starting code generation and execution with max retries: ${maxRetry}`);
    
    let counter = 0;
    let success = false;
    let code = '';
    let result = '';
    let executionError = null;
    
    // Prepare plan status
    const planStatus = this.use_plan && this.planner ? this.planner.get_plan_status() : '';
    
    // Prepare tool info
    let toolInfo = '';
    if (this.tool_recommender) {
      const messages = await this.working_memory?.get();
      const context = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
      const plan = this.use_plan && this.planner ? this.planner.plan : null;
      
      toolInfo = await this.tool_recommender.getRecommendedToolInfo(context, plan);
      logger.info(`[${this.name}] Tool recommendation complete, found ${toolInfo ? 'tools to use' : 'no relevant tools'}`);
    }
    
    // 提前检查数据和环境
    logger.info(`[${this.name}] Checking data and Python environment...`);
    const dataCheckSuccess = await this.checkData();
    if (!dataCheckSuccess) {
      logger.warn(`[${this.name}] Data check failed or skipped, proceeding anyway`);
    }
    
    // Try to write and execute code, with retries
    while (!success && counter < maxRetry) {
      try {
        logger.info(`[${this.name}] 🧠 Code generation attempt ${counter + 1} of ${maxRetry}`);
        
        // Write code
        [code] = await this.writeCode();
        
        if (!code || code.trim() === '') {
          logger.error(`[${this.name}] Generated empty code, retrying...`);
          counter++;
          continue;
        }
        
        // 在执行代码前检查和安装依赖
        await this.manageDependencies(code, this.filename);
        
        // Add code to working memory
        if (this.working_memory) {
          await this.addToWorkingMemory(this.createAnalysisMessage(
            `Generated Python code (attempt ${counter + 1})`,
            { code, phase: 'code_generation', attempt: counter + 1 }
          ));
        }
        
        // Execute code
        logger.info(`[${this.name}] 🚀 Executing code (attempt ${counter + 1})...`);
        [result, success] = await this.execute_code.run(code);
        
        // Handle execution result
        if (success) {
          logger.info(`[${this.name}] ✅ Code execution successful!`);
          
          // Add execution result to working memory
          await this.addToWorkingMemory(this.createAnalysisMessage(
            result,
            { phase: 'code_execution', success: true, attempt: counter + 1 }
          ));
        } else {
          logger.warn(`[${this.name}] ❌ Code execution failed (attempt ${counter + 1})`);
          executionError = new Error(result);
          
          // Add error to working memory
          await this.addToWorkingMemory(this.createErrorMessage(
            executionError,
            'EXECUTION_ERROR'
          ));
          
          // Use reflection if enabled after first attempt
          if (counter > 0 && this.use_reflection) {
            logger.info(`[${this.name}] Using reflection to improve code...`);
            // Here we would implement reflection similar to Python version
          }
        }
      } catch (error) {
        const typedError = error as Error;
        logger.error(`[${this.name}] Error during code generation/execution:`, typedError);
        
        // Add error to working memory
        await this.addToWorkingMemory(this.createErrorMessage(
          typedError,
          'GENERATION_ERROR'
        ));
        
        success = false;
        executionError = typedError;
      }
      
      counter++;
    }
    
    // Handle final failure after all retries
    if (!success) {
      logger.error(`[${this.name}] All ${maxRetry} attempts failed. Last error: ${executionError?.message}`);
      
      // Add final failure message to working memory
      await this.addToWorkingMemory(this.createErrorMessage(
        new Error(`Failed after ${maxRetry} attempts: ${executionError?.message || 'Unknown error'}`),
        'MAX_RETRIES_EXCEEDED'
      ));
    }
    
    return [code, result, success];
  }

  /**
   * Run the data interpreter with support for streaming
   */
  public async run(message: Message, options?: StreamOptions): Promise<Message> {
    try {
      logger.info(`[${this.name}] Starting run with${options?.mode === RunMode.STREAMING ? ' streaming' : ' regular'} mode`);
      
      // Add message to memory
      await this.addToMemory(message);

      if (options?.mode === RunMode.STREAMING) {
        return await this.runWithStreaming(options.streamCallback);
      } else {
        return await this.runRegular();
      }
    } catch (error) {
      const typedError = error as Error;
      logger.error(`[${this.name}] Error in run method: ${typedError.message}`);
      
      // Add error to working memory if possible
      try {
        await this.addToWorkingMemory(this.createErrorMessage(
          typedError,
          'RUN_ERROR'
        ));
      } catch (memoryError) {
        logger.error(`[${this.name}] Failed to add error to working memory: ${(memoryError as Error).message}`);
      }
      
      return this.createMessage('Cannot determine next action. Please try again.');
    }
  }

  /**
   * Run with streaming output
   */
  private async runWithStreaming(callback?: StreamCallback): Promise<Message> {
    const sections = ['Data Loading', 'Exploratory Analysis', 'Statistical Analysis', 'Visualization', 'Model Training', 'Conclusion'];
    let currentSection = '';
    let fullContent = '';
    let analysisStartTime = Date.now();
    
    // Store the original generate method
    const originalGenerate = this.llm.generate.bind(this.llm);

    try {
      logger.info(`[${this.name}] Setting up streaming analysis pipeline...`);
      const boundCallback = callback?.bind(this);
      
      // Create a wrapped generate function that maintains the original context
      this.llm.generate = async (prompt: string) => {
        try {
          logger.debug(`[${this.name}] Generating content for prompt (length: ${prompt.length})`);
          const response = await originalGenerate(prompt);
          
          // Find current section
          for (const section of sections) {
            if (response.includes(section) && currentSection !== section) {
              currentSection = section;
              logger.info(`[${this.name}] 📊 New section detected: ${currentSection}`);
              break;
            }
          }

          // Call streaming callback
          if (boundCallback) {
            try {
              boundCallback(response, currentSection);
            } catch (callbackError) {
              logger.error(`[${this.name}] Error in streaming callback: ${(callbackError as Error).message}`);
            }
          }

          fullContent += response;
          return response;
        } catch (error) {
          const generateError = error as Error;
          logger.error(`[${this.name}] Error in generate during streaming: ${generateError.message}`);
          
          // Add error to memory
          await this.addToWorkingMemory(this.createErrorMessage(
            generateError,
            'STREAMING_GENERATION_ERROR'
          ));
          
          // Propagate error
          throw generateError;
        }
      };

      // Run the analysis
      logger.info(`[${this.name}] Starting analysis in ${this.react_mode} mode`);
      const result = this.react_mode === 'react' 
        ? await this.react()
        : await this.planAndAct();

      const analysisTime = ((Date.now() - analysisStartTime) / 1000).toFixed(2);
      logger.info(`[${this.name}] Analysis completed in ${analysisTime} seconds`);

      // Restore original generate method
      this.llm.generate = originalGenerate;

      return result;
    } catch (error) {
      const streamError = error as Error;
      logger.error(`[${this.name}] Error in streaming analysis: ${streamError.message}`, streamError);
      
      // Restore original generate method in case of error
      this.llm.generate = originalGenerate;
      
      // Create error response message
      const errorMessage = this.createMessage(
        `Error occurred during streaming analysis: ${streamError.message}. Analysis time: ${((Date.now() - analysisStartTime) / 1000).toFixed(2)}s`
      );
      
      // Add error to memory
      await this.addToWorkingMemory(this.createErrorMessage(
        streamError,
        'STREAMING_ERROR'
      ));
      
      return errorMessage;
    }
  }

  /**
   * Execute in React mode
   */
  public override async react(): Promise<Message> {
    try {
      let needsMoreAction = true;
      let loopCount = 0;
      let lastMessage: Message | null = null;
      const startTime = Date.now();

      logger.info(`[${this.name}] Starting react loop (max iterations: ${this.max_react_loop})`);

      while (needsMoreAction && loopCount < this.max_react_loop) {
        logger.info(`[${this.name}] React iteration ${loopCount + 1}/${this.max_react_loop}`);
        
        // Think about what to do next
        needsMoreAction = await this.think();
        
        if (needsMoreAction) {
          // Execute the action
          logger.info(`[${this.name}] Needs further action, executing act() method`);
          lastMessage = await this.act();
        } else {
          logger.info(`[${this.name}] Analysis complete, no further action needed`);
        }
        
        loopCount++;
      }

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (loopCount >= this.max_react_loop && needsMoreAction) {
        logger.warn(`[${this.name}] Reached maximum react loop count (${this.max_react_loop})`);
        
        // Add max iterations warning to memory
        await this.addToWorkingMemory(this.createAnalysisMessage(
          `Reached maximum iterations (${this.max_react_loop}). Analysis may be incomplete.`,
          { 
            warning: true, 
            maxIterations: this.max_react_loop,
            elapsedTime: `${elapsedTime}s`
          }
        ));
      }
      
      logger.info(`[${this.name}] React loop completed in ${elapsedTime}s after ${loopCount} iterations`);

      // If no message was generated, create a completion message
      if (!lastMessage) {
        lastMessage = this.createMessage(`Analysis completed in ${elapsedTime}s after ${loopCount} iterations.`);
      }

      return lastMessage;
    } catch (error) {
      const reactError = error as Error;
      logger.error(`[${this.name}] Error in react method: ${reactError.message}`, reactError);
      
      // Add error to memory
      await this.addToWorkingMemory(this.createErrorMessage(
        reactError,
        'REACT_ERROR'
      ));
      
      return this.createMessage(`Error during analysis: ${reactError.message}. Please try again.`);
    }
  }

  /**
   * Run in regular mode
   */
  private async runRegular(): Promise<Message> {
    try {
      logger.info(`[${this.name}] Starting regular analysis in ${this.react_mode} mode`);
      const startTime = Date.now();
      
      const result = this.react_mode === 'react'
        ? await this.react()
        : await this.planAndAct();
      
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`[${this.name}] Regular analysis completed in ${elapsedTime}s`);
      
      return result;
    } catch (error) {
      const runError = error as Error;
      logger.error(`[${this.name}] Error in regular analysis: ${runError.message}`, runError);
      
      // Add error to memory
      await this.addToWorkingMemory(this.createErrorMessage(
        runError,
        'REGULAR_RUN_ERROR'
      ));
      
      return this.createMessage(`Error during analysis: ${runError.message}. Please try again.`);
    }
  }

  /**
   * Check data before analysis
   */
  private async checkData(): Promise<boolean> {
    logger.info(`[${this.name}] Checking data compatibility...`);
    try {
      const checkAction = new CheckData({ llm: this.llm });
      const result = await checkAction.run();
      const success = result.status === 'completed';
      
      if (success) {
        logger.info(`[${this.name}] ✅ Data check successful`);
      } else {
        logger.warn(`[${this.name}] ⚠️ Data check returned unsuccessful status`);
      }
      
      return success;
    } catch (error) {
      const typedError = error as Error;
      logger.error(`[${this.name}] ❌ Error during data check: ${typedError.message}`);
      
      // Add error to working memory
      await this.addToWorkingMemory(this.createErrorMessage(
        typedError,
        'DATA_CHECK_ERROR'
      ));
      
      return false;
    }
  }

  /**
   * Write analysis code
   */
  private async writeCode(): Promise<[string, string]> {
    logger.info(`[${this.name}] Writing analysis code...`);
    try {
      const writeAction = new WriteAnalysisCode({ llm: this.llm });
      const result = await writeAction.run();
      return [result.content, 'WriteAnalysisCode'];
    } catch (error) {
      const typedError = error as Error;
      logger.error(`[${this.name}] Error writing code: ${typedError.message}`);
      
      // Add error to working memory
      await this.addToWorkingMemory(this.createErrorMessage(
        typedError,
        'CODE_WRITING_ERROR'
      ));
      
      return ['', 'ERROR'];
    }
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
   * 初始化依赖管理器
   */
  private initDependencyManager(): void {
    if (this.config.dependencyManagement?.enabled) {
      if (this.config.dependencyManagement.language) {
        this.useAutoLanguageDetection = false;
        this.dependencyManager = DependencyManagerFactory.create(
          this.config.dependencyManagement.language,
          this.config.dependencyManagement.config
        );
        logger.info(`[${this.name}] Initialized dependency manager for language: ${this.config.dependencyManagement.language}`);
      } else {
        this.useAutoLanguageDetection = true;
        logger.info(`[${this.name}] Will use auto language detection for dependency management`);
      }
      
      logger.info(`[${this.name}] Auto-installation of dependencies ${this.config.dependencyManagement.autoInstall ? 'enabled' : 'disabled'}`);
    } else {
      logger.info(`[${this.name}] Dependency management disabled`);
    }
  }

  /**
   * 检查和安装依赖
   * @param code 代码内容
   * @param filename 文件名，用于语言检测
   */
  private async manageDependencies(code: string, filename: string): Promise<void> {
    if (!this.config.dependencyManagement?.enabled || !code) {
      return;
    }
    
    try {
      // 如果需要自动检测语言
      if (this.useAutoLanguageDetection) {
        // 尝试从文件名推断语言
        let language = DependencyManagerFactory.inferLanguageFromFilename(filename);
        
        // 如果无法从文件名推断，尝试从代码推断
        if (!language) {
          language = DependencyManagerFactory.inferLanguageFromCode(code);
        }
        
        // 如果成功推断出语言，创建相应的依赖管理器
        if (language) {
          this.dependencyManager = DependencyManagerFactory.create(
            language,
            this.config.dependencyManagement.config
          );
          logger.info(`[${this.name}] Auto-detected language: ${language} for dependency management`);
        } else {
          logger.warn(`[${this.name}] Could not detect language for dependency management`);
          return;
        }
      }
      
      // 如果有依赖管理器，检查并安装依赖
      if (this.dependencyManager) {
        const dependencies = await this.dependencyManager.extractDependencies(code);
        logger.info(`[${this.name}] Extracted dependencies: ${dependencies.join(', ') || 'none'}`);
        
        if (dependencies.length > 0) {
          const analysisResult = await this.dependencyManager.checkDependencies(dependencies);
          logger.info(`[${this.name}] Dependency check result: ${analysisResult.missingDependencies.length} missing`);
          
          if (analysisResult.missingDependencies.length > 0 && this.config.dependencyManagement.autoInstall) {
            logger.info(`[${this.name}] Installing missing dependencies: ${analysisResult.missingDependencies.join(', ')}`);
            const installResult = await this.dependencyManager.installDependencies(analysisResult.missingDependencies);
            
            if (installResult.success) {
              logger.info(`[${this.name}] Successfully installed dependencies`);
            } else {
              logger.warn(`[${this.name}] Failed to install some dependencies: ${installResult.failed.join(', ')}`);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`[${this.name}] Error in dependency management: ${error}`);
      // 依赖管理失败不应影响代码执行
    }
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    try {
      // 终止执行引擎
      if (this.execute_code) {
        await this.execute_code.terminate();
      }
      
      // 清理依赖管理器
      if (this.dependencyManager && typeof this.dependencyManager.cleanup === 'function') {
        await this.dependencyManager.cleanup();
      }
      
      logger.info(`[${this.name}] Cleanup completed`);
    } catch (error) {
      logger.error(`[${this.name}] Error during cleanup: ${error}`);
    }
  }
}