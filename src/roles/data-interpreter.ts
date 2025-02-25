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
 * 数据解释器配置接口
 */
export interface DataInterpreterConfig {
  llm: LLMProvider;
  auto_run?: boolean;
  use_plan?: boolean;
  use_reflection?: boolean;
  tools?: string[];
  react_mode?: 'plan_and_act' | 'react';
  max_react_loop?: number;
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

  /**
   * 构造函数
   */
  constructor(config: DataInterpreterConfig) {
    super(
      'David',
      'DataInterpreter',
      'Analyze data and provide insights through code generation and execution',
      'Write clean, efficient, and well-documented code for data analysis',
      []
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
    
    // Initialize tool recommender if tools are provided
    if (this.tools.length > 0) {
      this.tool_recommender = new BM25ToolRecommender(this.tools);
    }
    
    // Initialize actions
    this.initialize();
  }
  
  /**
   * 初始化角色
   */
  private initialize(): void {
    console.log('[DataInterpreter] Initializing role');
    
    // Set react mode and working memory
    this.setReactMode(this.react_mode, this.max_react_loop, this.auto_run);
    
    // Override use_plan based on react_mode for consistency
    this.use_plan = this.react_mode === 'plan_and_act';
    
    // Set initial action
    this.actions = [new WriteAnalysisCode({ llm: this.llm })];
    
    // Set initial state
    this.context.state = 0;
    this.setTodo(this.actions[0]);
    
    console.log('[DataInterpreter] Initialization complete');
  }
  
  /**
   * 设置反应模式
   */
  private setReactMode(mode: 'plan_and_act' | 'react', maxLoop: number, autoRun: boolean): void {
    this.react_mode = mode;
    
    if (mode === 'react') {
      this.context.reactMode = 'react';
      this.max_react_loop = maxLoop;
    } else {
      this.context.reactMode = 'plan_and_act';
      // Initialize planner here (simplified)
      // In a full implementation, we would instantiate a proper Planner class
      this.planner = {
        plan: { 
          tasks: [], 
          get_finished_tasks: () => [], 
          current_task: null,
          get_plan_status: () => ""
        },
        ask_review: async () => ["", false],
        set_working_memory: (wm: any) => {}
      };
      
      if (!this.context.workingMemory) {
        this.context.workingMemory = new ArrayMemory();
      }
      
      // Connect planner with working memory
      if (this.planner && this.planner.set_working_memory) {
        this.planner.set_working_memory(this.context.workingMemory);
      }
    }
  }
  
  /**
   * 获取工作记忆
   */
  get working_memory(): ArrayMemory {
    return this.context.workingMemory;
  }
  
  /**
   * 思考下一步行动（React 模式下使用）
   */
  async think(): Promise<boolean> {
    console.log('[DataInterpreter] Starting think method');
    
    // Get user requirement and context
    const memories = await this.context.memory.get();
    if (!memories || memories.length === 0) {
      console.warn('[DataInterpreter] No memories available');
      return false;
    }
    
    const user_requirement = memories[0].content;
    const context = this.working_memory ? await this.working_memory.get() : [];
    
    if (!context || context.length === 0) {
      // Just started the run, we need action certainly
      console.log('[DataInterpreter] No context available, adding user requirement to working memory');
      if (this.working_memory) {
        this.working_memory.add(memories[0]);
      }
      this.context.state = 0;
      this.setTodo(this.actions[0]);
      return true;
    }
    
    // Format context for prompt
    const contextText = context.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
    
    // Create thinking prompt
    const prompt = REACT_THINK_PROMPT
      .replace('{user_requirement}', user_requirement)
      .replace('{context}', contextText);
    
    console.log('[DataInterpreter] Sending think prompt to LLM');
    
    // Get LLM response
    const response = await this.llm.generate(prompt);
    console.log(`[DataInterpreter] Received LLM response: ${response.substring(0, 100)}...`);
    
    // Parse JSON response
    try {
      const jsonStr = response.replace(/```json|```/g, '').trim();
      const responseObj = JSON.parse(jsonStr);
      
      // Add thoughts to working memory
      if (this.working_memory) {
        this.working_memory.add({
          id: uuidv4(),
          content: responseObj.thoughts,
          role: 'assistant',
          causedBy: 'think',
          sentFrom: this.name,
          sendTo: new Set(['*']),
          instructContent: null
        });
      }
      
      // Set state based on whether more action is needed
      const needAction = responseObj.state;
      this.context.state = needAction ? 0 : -1;
      if (needAction) {
        this.setTodo(this.actions[0]);
      } else {
        this.setTodo(null);
      }
      
      console.log(`[DataInterpreter] Think result: need further action = ${needAction}`);
      return needAction;
    } catch (error) {
      console.error('[DataInterpreter] Error parsing LLM response:', error);
      // Default to taking action if parsing fails
      this.context.state = 0;
      this.setTodo(this.actions[0]);
      return true;
    }
  }
  
  /**
   * 执行行动（React 模式下使用）
   */
  async act(): Promise<Message> {
    console.log('[DataInterpreter] Starting act method');
    
    const [code, result, isSuccess] = await this.writeAndExecCode();
    
    const message: Message = {
      id: uuidv4(),
      content: code,
      role: 'assistant',
      causedBy: 'WriteAnalysisCode',
      sentFrom: this.name,
      sendTo: new Set(['*']),
      instructContent: null
    };
    
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
      const context = this.working_memory && this.working_memory.get().length > 0 
        ? this.working_memory.get()[this.working_memory.get().length - 1].content 
        : '';
      const plan = this.use_plan && this.planner ? this.planner.plan : null;
      
      toolInfo = await this.tool_recommender.getRecommendedToolInfo(context, plan);
    }
    
    // Check data (in a full implementation, this would interact with actual data)
    await this.checkData();
    
    // Try to write and execute code, with retries
    while (!success && counter < maxRetry) {
      console.log(`[DataInterpreter] Code execution attempt ${counter + 1} of ${maxRetry}`);
      
      // Write code
      [code] = await this.writeCode(counter, planStatus, toolInfo);
      
      // Add code to working memory
      if (this.working_memory) {
        this.working_memory.add({
          id: uuidv4(),
          content: code,
          role: 'assistant',
          causedBy: 'WriteAnalysisCode',
          sentFrom: this.name,
          sendTo: new Set(['*']),
          instructContent: null
        });
      }
      
      // Execute code
      [result, success] = await this.execute_code.run(code);
      console.log(`Execution result: ${success ? 'Success' : 'Failed'}`);
      
      if (!success) {
        console.log(`[DataInterpreter] Code execution failed, retrying...`);
      }
    }
    
    return [code, result, success];
  }
}