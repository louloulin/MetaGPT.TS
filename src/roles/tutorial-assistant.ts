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