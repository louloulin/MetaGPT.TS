import { z } from 'zod';
import type { ActionOutput } from '../types/action';
import type { LLMProvider } from '../types/llm';
import { BaseAction } from './base-action';

/**
 * 动作配置接口
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
 * 目录结构类型定义
 */
export type Directory = {
  title: string;
  directory: Array<Record<string, string[]>>;
};

/**
 * 目录结构模式验证
 */
export const DirectorySchema = z.object({
  title: z.string(),
  directory: z.array(z.record(z.string(), z.array(z.string()))),
});

/**
 * 教程目录生成动作配置
 */
export interface WriteDirectoryConfig extends ActionConfig {
  language?: string;
}

/**
 * 教程目录生成动作
 */
export class WriteDirectory extends BaseAction {
  language: string;

  constructor(config: WriteDirectoryConfig) {
    super({
      ...config,
      name: 'WriteDirectory',
    });
    this.language = config.language || 'Chinese';
    console.log(`[WriteDirectory] Initialized with language: ${this.language}`);
  }

  /**
   * 执行动作，生成教程目录结构
   */
  async run(): Promise<ActionOutput> {
    try {
      console.log('[WriteDirectory] Starting run() method');
      const topic = this.getArg<string>('topic') || '';
      console.log(`[WriteDirectory] Topic: "${topic}"`);
      
      if (!topic) {
        console.warn('[WriteDirectory] Topic is required but not provided');
        return this.createOutput('Topic is required', 'failed');
      }

      const prompt = this.generateDirectoryPrompt(topic);
      console.log(`[WriteDirectory] Generated prompt (${prompt.length} characters)`);
      console.log('[WriteDirectory] Calling LLM to generate directory structure');
      
      const result = await this.llm.generate(prompt);
      console.log(`[WriteDirectory] Received response from LLM (${result.length} characters)`);
      
      // 解析JSON结果
      try {
        console.log('[WriteDirectory] Parsing LLM response as JSON');
        const jsonStr = result.replace(/```json|```/g, '').trim();
        console.log(`[WriteDirectory] Cleaned JSON string: ${jsonStr.substring(0, 100)}...`);
        
        const parsed = JSON.parse(jsonStr);
        console.log('[WriteDirectory] JSON parsed successfully');
        
        const directory = DirectorySchema.parse(parsed);
        console.log(`[WriteDirectory] Directory schema validated: ${directory.title} with ${directory.directory.length} sections`);
        
        return this.createOutput(
          JSON.stringify(directory),
          'completed',
          directory
        );
      } catch (e) {
        console.error('[WriteDirectory] Failed to parse directory structure JSON:', e);
        console.log('[WriteDirectory] Original LLM response:', result);
        
        // 返回默认结构
        const defaultDirectory: Directory = {
          title: `Tutorial for ${topic}`,
          directory: [
            { "Introduction": ["Overview", "Prerequisites"] },
            { "Main Content": ["Basic Concepts", "Advanced Usage"] },
            { "Conclusion": ["Summary", "Next Steps"] }
          ]
        };
        
        console.log('[WriteDirectory] Using default directory structure instead');
        return this.createOutput(
          JSON.stringify(defaultDirectory),
          'completed',
          defaultDirectory
        );
      }
    } catch (error) {
      console.error('[WriteDirectory] Error generating directory:', error);
      if (error instanceof Error) {
        await this.handleException(error);
      }
      return this.createOutput(`Failed to generate directory: ${error}`, 'failed');
    }
  }

  /**
   * 生成目录结构的提示词
   * @param topic 教程主题
   * @returns 提示词
   */
  private generateDirectoryPrompt(topic: string): string {
    const language = this.language === 'Chinese' ? '中文' : 'English';
    return `请为主题"${topic}"创建一个完整的教程目录结构。目录应该结构清晰、内容全面、逻辑连贯。

请使用以下JSON格式输出目录结构：
{
  "title": "教程标题",
  "directory": [
    {"第一章标题": ["1.1 小节标题", "1.2 小节标题", ...]},
    {"第二章标题": ["2.1 小节标题", "2.2 小节标题", ...]},
    ...
  ]
}

请确保输出是有效的JSON格式，目录结构要反映${language}教程的完整性、系统性和专业性。`;
  }
}

/**
 * 教程内容生成动作配置
 */
export interface WriteContentConfig extends ActionConfig {
  language?: string;
  directory: Record<string, string[]>;
}

/**
 * 教程内容生成动作
 */
export class WriteContent extends BaseAction {
  language: string;
  directory: Record<string, string[]>;

  constructor(config: WriteContentConfig) {
    super({
      ...config,
      name: 'WriteContent',
    });
    this.language = config.language || 'Chinese';
    this.directory = config.directory;
    
    const sectionTitle = Object.keys(this.directory)[0];
    const subsections = this.directory[sectionTitle];
    console.log(`[WriteContent] Initialized for section "${sectionTitle}" with ${subsections.length} subsections`);
  }

  /**
   * 执行动作，生成教程内容
   */
  async run(): Promise<ActionOutput> {
    try {
      console.log('[WriteContent] Starting run() method');
      
      const topic = this.getArg<string>('topic') || '';
      console.log(`[WriteContent] Topic: "${topic}"`);
      
      if (!topic) {
        console.warn('[WriteContent] Topic is required but not provided');
        return this.createOutput('Topic is required', 'failed');
      }

      const sectionTitle = Object.keys(this.directory)[0];
      console.log(`[WriteContent] Generating content for section: "${sectionTitle}"`);
      
      const prompt = this.generateContentPrompt(topic);
      console.log(`[WriteContent] Generated prompt (${prompt.length} characters)`);
      console.log('[WriteContent] Calling LLM to generate content');
      
      const result = await this.llm.generate(prompt);
      console.log(`[WriteContent] Received response from LLM (${result.length} characters)`);
      
      return this.createOutput(result.trim(), 'completed');
    } catch (error) {
      console.error('[WriteContent] Error generating content:', error);
      if (error instanceof Error) {
        await this.handleException(error);
      }
      return this.createOutput(`Failed to generate content: ${error}`, 'failed');
    }
  }

  /**
   * 生成内容的提示词
   * @param topic 教程主题
   * @returns 提示词
   */
  private generateContentPrompt(topic: string): string {
    const language = this.language === 'Chinese' ? '中文' : 'English';
    const sectionTitle = Object.keys(this.directory)[0];
    const subsections = this.directory[sectionTitle];
    
    return `请为主题"${topic}"下的"${sectionTitle}"章节编写详细内容。请包含以下小节：${subsections.join('、')}。

要求：
1. 使用${language}编写
2. 严格遵循Markdown语法，布局整洁规范
3. 内容应该专业、详细、通俗易懂
4. 提供实用的信息和示例
5. 每个小节都应该有适当的标题（使用## 和 ###）
6. 总字数应该在1000-2000字之间

请直接输出Markdown内容，不需要有额外的注释。`;
  }
} 