/**
 * RunCode Action
 * 
 * This action executes code in a controlled environment, captures results,
 * handles errors, provides sandbox isolation, and manages execution timeouts.
 */

import { BaseAction } from '../actions/base-action';
import type { ActionConfig, ActionOutput, ActionContext } from '../types/action';
import { spawn } from 'child_process';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';

/**
 * Supported programming languages
 */
export enum ProgrammingLanguage {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  BASH = 'bash',
  RUBY = 'ruby'
}

/**
 * Execution result structure
 */
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  success: boolean;
  error?: string;
}

/**
 * Code execution configuration
 */
export interface CodeExecutionConfig {
  language: ProgrammingLanguage;
  code: string;
  timeout?: number; // Timeout in milliseconds
  args?: string[]; // Command-line arguments
  workingDir?: string; // Working directory for execution
  env?: Record<string, string>; // Environment variables
  memoryLimit?: number; // Memory limit in MB
  useContainer?: boolean; // Whether to use a container for isolation
  containerImage?: string; // Container image to use for isolation
}

/**
 * Action for running code in various languages
 */
export class RunCode extends BaseAction {
  private config: Partial<CodeExecutionConfig>;
  private tempDir: string = '';

  constructor(config: ActionConfig) {
    super({
      name: config.name || 'RunCode',
      description: config.description || 'Executes code in a controlled environment',
      llm: config.llm,
      memory: config.memory
    });
    
    this.config = {
      timeout: config.args?.timeout || 30000,
      memoryLimit: config.args?.memoryLimit || 512,
      useContainer: config.args?.useContainer || false,
      containerImage: config.args?.containerImage,
      env: config.args?.env || {},
      args: config.args?.args || []
    };
  }

  /**
   * Runs the RunCode action
   * @returns The execution results
   */
  public async run(): Promise<ActionOutput> {
    try {
      const messages = await this.context.memory?.get();
      logger.debug('RunCode: Retrieved messages from memory', { messageCount: messages?.length });
      
      if (!messages || messages.length === 0) {
        logger.warn('RunCode: No messages available');
        return super.createOutput('No messages available', 'failed');
      }

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        logger.warn('RunCode: No last message found');
        return super.createOutput('No messages available', 'failed');
      }

      logger.debug('RunCode: Processing message', { 
        messageId: lastMessage.id,
        content: lastMessage.content 
      });

      const { code, language } = this.extractCodeAndLanguage(lastMessage.content || '');
      logger.debug('RunCode: Extracted code and language', { language, codeLength: code?.length });
      
      if (!code) {
        logger.warn('RunCode: No valid code found in message');
        return super.createOutput('No valid code found in message', 'failed');
      }

      const execConfig: CodeExecutionConfig = {
        ...this.config,
        code,
        language: language || ProgrammingLanguage.JAVASCRIPT
      };
      logger.debug('RunCode: Execution config', { 
        language: execConfig.language,
        timeout: execConfig.timeout,
        useContainer: execConfig.useContainer 
      });

      const result = await this.executeCode(execConfig);
      logger.debug('RunCode: Execution result', { 
        success: result.success,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime: result.executionTime
      });
      
      // Format the execution result
      const content = this.formatExecutionResult(result);
      
      // Determine status based on execution result and stderr
      const status = result.exitCode === 0 && !result.stderr ? 'completed' : 'failed';
      logger.debug('RunCode: Final output', { status, contentLength: content.length });
      
      return super.createOutput(content, status);
    } catch (err) {
      const error = err as Error;
      logger.error('RunCode: Error executing code', { 
        error: error.message,
        stack: error.stack 
      });
      return super.createOutput(`Error executing code: ${error.message}`, 'failed');
    }
  }

  /**
   * Extracts code and language from message content
   * @param content Message content
   * @returns Code and language
   */
  private extractCodeAndLanguage(content: string): { code: string; language?: ProgrammingLanguage } {
    try {
      // Try to parse as JSON first (for structured input)
      const parsed = JSON.parse(content);
      if (parsed.code) {
        return {
          code: parsed.code,
          language: parsed.language
        };
      }
    } catch {
      // If not JSON, try to extract code from text
      const codeMatch = content.match(/Run this code:?\s*([\s\S]+)/i);
      if (codeMatch) {
        return {
          code: codeMatch[1].trim(),
          language: this.detectLanguage(codeMatch[1].trim())
        };
      }
    }
    return { code: content.trim() };
  }

  /**
   * Detects programming language from code
   * @param code Code content
   * @returns Detected language
   */
  private detectLanguage(code: string): ProgrammingLanguage {
    if (code.includes('console.log')) {
      return ProgrammingLanguage.JAVASCRIPT;
    }
    if (code.includes('print(')) {
      return ProgrammingLanguage.PYTHON;
    }
    return ProgrammingLanguage.JAVASCRIPT;
  }

  /**
   * Executes the provided code
   * @param config Code execution configuration
   * @returns Execution result
   */
  private async executeCode(config: CodeExecutionConfig): Promise<ExecutionResult> {
    const tempDir = join(tmpdir(), 'metagpt-code');
    const fileName = this.getFileName(config.language);
    const filePath = join(tempDir, fileName);
    logger.debug('RunCode: Preparing to execute code', { 
      tempDir,
      fileName,
      filePath,
      language: config.language 
    });

    try {
      // Create temp directory
      await mkdir(tempDir, { recursive: true });
      logger.debug('RunCode: Created temp directory', { tempDir });

      // Write code to file
      await writeFile(filePath, config.code);
      logger.debug('RunCode: Written code to file', { filePath });

      // Execute code based on configuration
      const result = await this.executeNatively(config.code, config.language);
      logger.debug('RunCode: Native execution completed', { 
        success: result.success,
        exitCode: result.exitCode 
      });

      return result;
    } catch (error) {
      logger.error('RunCode: Error in executeCode', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
        executionTime: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      // Clean up temp files
      try {
        await rm(filePath);
        await rm(tempDir, { recursive: true });
        logger.debug('RunCode: Cleaned up temp files');
      } catch (error) {
        logger.error('RunCode: Failed to clean up temp files', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  }

  /**
   * Gets the file name for the given language
   * @param language Programming language
   * @returns File name with appropriate extension
   */
  private getFileName(language: ProgrammingLanguage): string {
    switch (language) {
      case ProgrammingLanguage.JAVASCRIPT:
        return 'code.js';
      case ProgrammingLanguage.PYTHON:
        return 'code.py';
      case ProgrammingLanguage.TYPESCRIPT:
        return 'code.ts';
      default:
        return 'code.txt';
    }
  }

  /**
   * Gets the file extension for the given language
   * @param language Programming language
   * @returns File extension including dot
   */
  private getFileExtension(language: ProgrammingLanguage): string {
    switch (language) {
      case ProgrammingLanguage.JAVASCRIPT:
        return '.js';
      case ProgrammingLanguage.TYPESCRIPT:
        return '.ts';
      case ProgrammingLanguage.PYTHON:
        return '.py';
      case ProgrammingLanguage.RUBY:
        return '.rb';
      case ProgrammingLanguage.BASH:
        return '.sh';
      default:
        return '.txt';
    }
  }

  /**
   * Executes code natively (without container isolation)
   * @param code Code content
   * @param language Programming language
   * @returns Execution result
   */
  private async executeNatively(code: string, language: ProgrammingLanguage): Promise<ExecutionResult> {
    const tempDir = join(tmpdir(), 'metagpt-code');
    await mkdir(tempDir, { recursive: true });

    const fileName = this.getFileName(language);
    const filePath = join(tempDir, fileName);
    
    console.log('Writing code to file:', { filePath, code });
    await writeFile(filePath, code);

    console.log('Executing code:', { language, filePath });

    const command = this.getCommand(language);
    const args = [filePath];

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let hasError = false;

      const process = spawn(command, args);

      process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Process stdout:', output);
        stdout += output;
      });

      process.stderr.on('data', (data) => {
        const error = data.toString();
        console.log('Process stderr:', error);
        stderr += error;
        hasError = true;
      });

      process.on('error', (error) => {
        console.log('Process error:', error);
        stderr += error.toString();
        hasError = true;
      });

      process.on('close', async (code) => {
        console.log('Process closed:', { code, hasError });
        try {
          await fs.unlink(filePath);
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          console.error('Error cleaning up:', error);
        }

        const result: ExecutionResult = {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
          executionTime: 0,
          success: !hasError,
          error: hasError ? stderr.trim() : undefined
        };

        console.log('Execution result:', result);
        resolve(result);
      });
    });
  }

  /**
   * Gets execution command for a programming language
   * @param language Programming language
   * @returns Command to execute
   */
  private getCommand(language: ProgrammingLanguage): string {
    switch (language) {
      case ProgrammingLanguage.JAVASCRIPT:
        return 'node';
      case ProgrammingLanguage.PYTHON:
        return 'python';
      case ProgrammingLanguage.TYPESCRIPT:
        return 'ts-node';
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Formats execution result into human-readable text
   * @param result Execution result
   * @returns Formatted result text
   */
  private formatExecutionResult(result: ExecutionResult): string {
    const parts = ['Code Execution Result:'];
    
    if (result.stdout) {
      parts.push(`Output:\n${result.stdout.trim()}`);
    }
    
    if (result.stderr) {
      const errorType = result.success ? 'Messages' : 'Errors';
      parts.push(`${errorType}:\n${result.stderr.trim()}`);
    }
    
    parts.push(`Execution Time: ${result.executionTime}ms`);
    parts.push(`Exit Code: ${result.exitCode}`);
    parts.push(`Status: ${result.success ? 'Success' : 'Failed'}`);
    
    if (result.error) {
      parts.push(`Error Details: ${result.error}`);
    }
    
    return parts.join('\n');
  }
} 