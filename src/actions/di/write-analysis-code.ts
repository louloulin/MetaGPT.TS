import { BaseAction } from '../base-action';
import type { ActionOutput } from '../../types/action';
import type { LLMProvider } from '../../types/llm';
import type { Message } from '../../types/message';

// Define data info prompt template
export const DATA_INFO = `
# Data Information
{info}
`;

/**
 * ActionConfig配置接口
 */
export interface ActionConfig {
  name?: string;
  description?: string;
  args?: Record<string, any>;
  llm: LLMProvider;
  memory?: any;
  workingMemory?: any;
}

/**
 * WriteAnalysisCode配置接口
 */
export interface WriteAnalysisCodeConfig extends ActionConfig {
  llm: LLMProvider;
}

/**
 * 编写数据分析代码动作
 */
export class WriteAnalysisCode extends BaseAction {
  constructor(config: WriteAnalysisCodeConfig) {
    super({
      ...config,
      name: 'WriteAnalysisCode',
    });
    console.log('[WriteAnalysisCode] Initialized');
  }

  /**
   * 运行动作
   */
  async run(): Promise<ActionOutput> {
    try {
      console.log('[WriteAnalysisCode] Starting run method');
      
      // Get arguments
      const userRequirement = this.getArg<string>('user_requirement') || '';
      const planStatus = this.getArg<string>('plan_status') || '';
      const toolInfo = this.getArg<string>('tool_info') || '';
      const workingMemory = this.getArg<Message[]>('working_memory') || [];
      const useReflection = this.getArg<boolean>('use_reflection') || false;
      
      console.log(`[WriteAnalysisCode] User requirement: ${userRequirement.substring(0, 50)}...`);
      console.log(`[WriteAnalysisCode] Use reflection: ${useReflection}`);
      
      // Format working memory
      const workingMemoryText = workingMemory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n');
      
      // Generate prompt
      const prompt = this.generateCodePrompt(
        userRequirement,
        workingMemoryText,
        planStatus,
        toolInfo,
        useReflection
      );
      
      console.log(`[WriteAnalysisCode] Generated prompt (${prompt.length} characters)`);
      
      // Generate code with LLM
      console.log('[WriteAnalysisCode] Calling LLM to generate code');
      const result = await this.llm.generate(prompt);
      
      // Extract Python code
      const code = this.extractPythonCode(result);
      console.log(`[WriteAnalysisCode] Generated code (${code.length} characters)`);
      
      return this.createOutput(code, 'completed');
    } catch (error) {
      console.error('[WriteAnalysisCode] Error generating code:', error);
      return this.createOutput(`Error generating code: ${error}`, 'failed');
    }
  }
  
  /**
   * 生成代码提示词
   */
  private generateCodePrompt(
    userRequirement: string,
    workingMemory: string,
    planStatus: string = '',
    toolInfo: string = '',
    useReflection: boolean = false
  ): string {
    // Construct the prompt
    let prompt = `# Data Analysis Task
## User Requirement
${userRequirement}

`;

    // Add working memory if available
    if (workingMemory) {
      prompt += `## Context and History
${workingMemory}

`;
    }

    // Add plan status if available
    if (planStatus) {
      prompt += `## Current Plan Status
${planStatus}

`;
    }

    // Add tool info if available
    if (toolInfo) {
      prompt += `## Available Tools
${toolInfo}

`;
    }

    // Reflection instructions if enabled
    if (useReflection) {
      prompt += `## Reflection
Please review the previous code and execution results. Identify errors and issues, and make improvements.

`;
    }

    // Final instructions
    prompt += `## Instructions
Please write clean, efficient Python code to analyze the data according to the user requirement.
Use pandas, numpy, matplotlib, and other data science libraries as appropriate.
Include comments to explain your code.
Make sure your code is complete and executable.
Do not include markdown annotations, just write the Python code directly.

`;

    return prompt;
  }
  
  /**
   * 从LLM响应中提取Python代码
   */
  private extractPythonCode(text: string): string {
    // Try to extract code from markdown code blocks
    const pythonBlockRegex = /```(?:python)?\s*([\s\S]*?)```/g;
    const matches = text.match(pythonBlockRegex);
    
    if (matches && matches.length > 0) {
      // Extract code from the first code block
      const codeBlock = matches[0];
      return codeBlock.replace(/```(?:python)?\s*/, '').replace(/```$/, '').trim();
    }
    
    // If no code blocks found, assume the entire text is code
    return text.trim();
  }
}

/**
 * CheckData配置接口
 */
export interface CheckDataConfig extends ActionConfig {
  llm: LLMProvider;
}

/**
 * 检查数据动作
 */
export class CheckData extends BaseAction {
  constructor(config: CheckDataConfig) {
    super({
      ...config,
      name: 'CheckData',
    });
    console.log('[CheckData] Initialized');
  }
  
  /**
   * 运行动作
   */
  async run(): Promise<ActionOutput> {
    try {
      console.log('[CheckData] Starting run method');
      
      // In a full implementation, this would need to accept a plan and
      // create code to check the data based on the plan
      
      // For simplicity, we'll just return a basic data check script
      const code = `
import pandas as pd
import numpy as np

# Check if dataset exists
try:
  # Try to read a potential dataset (this is just a placeholder)
  df = pd.read_csv('data.csv')
  
  # Display basic information about the dataset
  print("Dataset Information:")
  print(f"Shape: {df.shape}")
  print("\\nFirst 5 rows:")
  print(df.head())
  print("\\nData types:")
  print(df.dtypes)
  print("\\nSummary statistics:")
  print(df.describe())
  print("\\nMissing values:")
  print(df.isnull().sum())
except Exception as e:
  print(f"Error loading dataset: {e}")
  print("No dataset available for analysis.")
`;
      
      console.log('[CheckData] Generated basic data check code');
      return this.createOutput(code, 'completed');
    } catch (error) {
      console.error('[CheckData] Error generating data check code:', error);
      return this.createOutput(`Error generating data check code: ${error}`, 'failed');
    }
  }
} 