import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BaseRole } from './base-role';
import { WriteDirectory, WriteContent } from '../actions/write-tutorial';
import type { Directory } from '../actions/write-tutorial';
import type { Message, MESSAGE_ROUTE } from '../types/message';
import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';

/**
 * 教程助手配置接口
 */
export interface TutorialAssistantConfig {
  llm: LLMProvider;
  language?: string;
  outputDir?: string;
}

/**
 * 流式回调函数类型
 */
export type StreamCallback = (chunk: string, sectionTitle: string) => void;

/**
 * 运行模式
 */
export enum RunMode {
  REGULAR = 'regular',
  STREAMING = 'streaming'
}

/**
 * 运行选项
 */
export interface RunOptions {
  mode?: RunMode;
  streamCallback?: StreamCallback;
}

/**
 * 教程助手，输入一个句子生成Markdown格式的教程文档
 */
export class TutorialAssistant extends BaseRole {
  language: string;
  outputDir: string;
  llm: LLMProvider;
  
  topic = '';
  mainTitle = '';
  totalContent = '';

  constructor(config: TutorialAssistantConfig) {
    super(
      'Stitch',
      'Tutorial Assistant',
      'Generate tutorial documents',
      'Strictly follow Markdown\'s syntax, with neat and standardized layout',
      []
    );
    
    logger.info('[TutorialAssistant] Initializing with config:', {
      language: config.language || 'Chinese',
      outputDir: config.outputDir || path.join(process.cwd(), 'tutorials')
    });
    
    this.language = config.language || 'Chinese';
    this.outputDir = config.outputDir || path.join(process.cwd(), 'tutorials');
    this.llm = config.llm;
    
    // 初始化动作
    this.initializeActions();
  }

  /**
   * 初始化动作列表
   */
  private initializeActions(): void {
    logger.info('[TutorialAssistant] Initializing actions');
    
    // 初始时只设置目录生成动作
    const writeDirectory = new WriteDirectory({
      llm: this.llm,
      language: this.language,
    });
    
    logger.info('[TutorialAssistant] Created WriteDirectory action');
    this.actions = [writeDirectory];
  }

  /**
   * 处理目录结构
   * @param directory 目录结构
   */
  private async handleDirectory(directory: Directory): Promise<void> {
    logger.info('[TutorialAssistant] Handling directory structure:', JSON.stringify(directory, null, 2));
    
    this.mainTitle = directory.title;
    this.totalContent += `# ${this.mainTitle}\n\n`;
    
    // 将所有章节内容生成动作添加到动作列表
    const actions = [...this.actions];
    
    logger.info(`[TutorialAssistant] Processing ${directory.directory.length} sections`);
    
    for (const section of directory.directory) {
      const sectionKey = Object.keys(section)[0];
      logger.info(`[TutorialAssistant] Creating WriteContent action for section: ${sectionKey}`);
      
      const writeContent = new WriteContent({
        llm: this.llm,
        language: this.language,
        directory: section,
      });
      
      actions.push(writeContent);
    }
    
    logger.info(`[TutorialAssistant] Updated actions list, now contains ${actions.length} actions`);
    this.actions = actions;
  }

  /**
   * 运行教程助手
   * @param message 输入消息
   * @param options 运行选项
   * @returns 处理结果
   */
  async run(message: Message, options?: RunOptions): Promise<Message> {
    const mode = options?.mode || RunMode.REGULAR;
    logger.info(`[TutorialAssistant] Running in ${mode} mode`);
    
    if (mode === RunMode.STREAMING) {
      return this.reactStream(message, options?.streamCallback);
    } else {
      return this.react(message);
    }
  }

  /**
   * 处理消息
   * @param message 输入消息
   * @returns 处理结果
   */
  async react(message: Message): Promise<Message> {
    logger.info('[TutorialAssistant] Starting react method with message:', message.content);
    
    try {
      // 保存主题
      this.topic = message.content;
      logger.info(`[TutorialAssistant] Set topic: "${this.topic}"`);
      
      // 执行所有动作
      logger.info(`[TutorialAssistant] Starting execution of ${this.actions.length} actions`);
      
      for (let i = 0; i < this.actions.length; i++) {
        const action = this.actions[i];
        logger.info(`[TutorialAssistant] Running action ${i+1}/${this.actions.length}: ${action.constructor.name}`);
        
        // 为动作设置主题参数
        if ('setArg' in action && typeof action.setArg === 'function') {
          logger.info(`[TutorialAssistant] Setting topic argument for action: "${this.topic}"`);
          action.setArg('topic', this.topic);
        }
        
        // 执行动作
        logger.info(`[TutorialAssistant] Executing action ${action.constructor.name}`);
        const result = await action.run();
        logger.info(`[TutorialAssistant] Action ${action.constructor.name} completed with status: ${result.status}`);
        
        if (result.status === 'failed') {
          logger.error(`[TutorialAssistant] Action failed: ${result.content}`);
          return this.createMessage(`Failed to generate tutorial: ${result.content}`);
        }
        
        // 处理目录生成结果
        if (action instanceof WriteDirectory) {
          logger.info('[TutorialAssistant] Processing WriteDirectory result');
          if (result.instructContent) {
            logger.info('[TutorialAssistant] Directory structure generated, handling it');
            await this.handleDirectory(result.instructContent as Directory);
          } else {
            logger.warn('[TutorialAssistant] WriteDirectory action did not produce instructContent');
          }
        } 
        // 处理内容生成结果
        else if (action instanceof WriteContent) {
          logger.info('[TutorialAssistant] Processing WriteContent result');
          if (this.totalContent.length > 0) {
            this.totalContent += '\n\n\n';
          }
          logger.info(`[TutorialAssistant] Adding content (${result.content.length} characters)`);
          this.totalContent += result.content;
        }
      }
      
      // 保存生成的内容到文件
      logger.info('[TutorialAssistant] All actions completed, saving content to file');
      const filePath = await this.saveToFile();
      logger.info(`[TutorialAssistant] Content saved to ${filePath}`);
      
      return this.createMessage(`Tutorial generated successfully and saved to ${filePath}`);
    } catch (error) {
      logger.error('[TutorialAssistant] Error in react method:', error);
      return this.createMessage(`Error generating tutorial: ${error}`);
    }
  }

  /**
   * 使用流式处理生成教程
   * @param message 输入消息
   * @param streamCallback 流式回调函数，用于处理每个文本块
   * @returns 处理结果
   */
  private async reactStream(message: Message, streamCallback?: StreamCallback): Promise<Message> {
    logger.info('[TutorialAssistant] Starting reactStream method with message:', message.content);
    
    try {
      // 保存主题
      this.topic = message.content;
      logger.info(`[TutorialAssistant] Set topic: "${this.topic}"`);
      
      // 执行目录生成动作（不使用流式处理）
      logger.info('[TutorialAssistant] Generating directory structure (non-streaming)');
      const writeDirectoryAction = this.actions[0];
      
      if ('setArg' in writeDirectoryAction && typeof writeDirectoryAction.setArg === 'function') {
        logger.info(`[TutorialAssistant] Setting topic argument for directory action: "${this.topic}"`);
        writeDirectoryAction.setArg('topic', this.topic);
      }
      
      const directoryResult = await writeDirectoryAction.run();
      logger.info(`[TutorialAssistant] Directory action completed with status: ${directoryResult.status}`);
      
      if (directoryResult.status === 'failed') {
        logger.error(`[TutorialAssistant] Directory action failed: ${directoryResult.content}`);
        return this.createMessage(`Failed to generate tutorial directory: ${directoryResult.content}`);
      }
      
      // 处理目录生成结果
      if (directoryResult.instructContent) {
        logger.info('[TutorialAssistant] Directory structure generated, handling it');
        await this.handleDirectory(directoryResult.instructContent as Directory);
      } else {
        logger.warn('[TutorialAssistant] WriteDirectory action did not produce instructContent');
        return this.createMessage('Failed to generate tutorial: Invalid directory structure');
      }
      
      // 使用流式处理生成内容
      logger.info(`[TutorialAssistant] Starting streaming content generation for ${this.actions.length - 1} sections`);
      
      // 从索引1开始，跳过目录生成动作
      for (let i = 1; i < this.actions.length; i++) {
        const action = this.actions[i];
        logger.info(`[TutorialAssistant] Running action ${i}/${this.actions.length - 1}: ${action.constructor.name}`);
        
        // 为动作设置主题参数
        if ('setArg' in action && typeof action.setArg === 'function') {
          logger.info(`[TutorialAssistant] Setting topic argument for action: "${this.topic}"`);
          action.setArg('topic', this.topic);
        }
        
        // 检查是否为WriteContent动作
        if (action instanceof WriteContent) {
          const sectionTitle = Object.keys(action.directory)[0];
          logger.info(`[TutorialAssistant] Generating content for section: "${sectionTitle}" with streaming`);
          
          // 添加章节标题到总内容
          if (this.totalContent.length > 0) {
            this.totalContent += '\n\n\n';
          }
          
          // 生成内容提示词
          const prompt = this.generateContentPrompt(this.topic, action.directory);
          logger.info(`[TutorialAssistant] Generated prompt for streaming (${prompt.length} characters)`);
          
          // 使用流式处理生成内容
          let sectionContent = '';
          
          // 检查action是否有askStream方法
          if ('askStream' in action && typeof (action as any).askStream === 'function') {
            logger.info('[TutorialAssistant] Using askStream method for streaming content generation');
            
            try {
              // 使用askStream方法获取流式响应
              for await (const chunk of (action as any).askStream(prompt)) {
                sectionContent += chunk;
                
                // 调用回调函数处理每个文本块
                if (streamCallback) {
                  streamCallback(chunk, sectionTitle);
                }
              }
            } catch (error) {
              logger.error(`[TutorialAssistant] Error in streaming content generation: ${error}`);
              // 如果流式生成失败，回退到非流式方法
              logger.info('[TutorialAssistant] Falling back to non-streaming method');
              const result = await action.run();
              sectionContent = result.content;
            }
          } else {
            // 如果action没有askStream方法，使用普通的run方法
            logger.info('[TutorialAssistant] Action does not support streaming, using regular run method');
            const result = await action.run();
            sectionContent = result.content;
          }
          
          // 添加生成的内容到总内容
          logger.info(`[TutorialAssistant] Adding content (${sectionContent.length} characters)`);
          this.totalContent += sectionContent;
        }
      }
      
      // 保存生成的内容到文件
      logger.info('[TutorialAssistant] All actions completed, saving content to file');
      const filePath = await this.saveToFile();
      logger.info(`[TutorialAssistant] Content saved to ${filePath}`);
      
      return this.createMessage(`Tutorial generated successfully and saved to ${filePath}`);
    } catch (error) {
      logger.error('[TutorialAssistant] Error in reactStream method:', error);
      return this.createMessage(`Error generating tutorial: ${error}`);
    }
  }

  /**
   * 生成内容的提示词
   * @param topic 教程主题
   * @param directory 目录结构
   * @returns 提示词
   */
  private generateContentPrompt(topic: string, directory: Record<string, string[]>): string {
    const language = this.language === 'Chinese' ? '中文' : 'English';
    const sectionTitle = Object.keys(directory)[0];
    const subsections = directory[sectionTitle];
    
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

  /**
   * 创建消息对象
   * @param content 消息内容
   * @returns 消息对象
   */
  protected createMessage(content: string): Message {
    logger.info(`[TutorialAssistant] Creating message: ${content}`);
    return {
      id: uuidv4(),
      content,
      role: this.profile,
      causedBy: 'TutorialAssistant',
      sentFrom: this.name,
      timestamp: new Date().toISOString(),
      sendTo: new Set(['*']),
      instructContent: null,
    };
  }

  /**
   * 保存内容到文件
   * @returns 文件路径
   */
  private async saveToFile(): Promise<string> {
    try {
      logger.info(`[TutorialAssistant] Saving content (${this.totalContent.length} characters) to file`);
      
      // 确保输出目录存在
      logger.info(`[TutorialAssistant] Creating output directory: ${this.outputDir}`);
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // 生成带时间戳的文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${this.mainTitle || 'Tutorial'}_${timestamp}.md`;
      const filePath = path.join(this.outputDir, fileName);
      
      logger.info(`[TutorialAssistant] Writing to file: ${filePath}`);
      
      // 写入文件
      await fs.writeFile(filePath, this.totalContent);
      logger.info(`[TutorialAssistant] File written successfully: ${filePath}`);
      
      return filePath;
    } catch (error) {
      logger.error('[TutorialAssistant] Error saving tutorial file:', error);
      throw error;
    }
  }
} 