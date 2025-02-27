/**
 * RunCode Action
 * 
 * This action executes code in a controlled environment, captures results,
 * handles errors, provides sandbox isolation, and manages execution timeouts.
 */

import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';
import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { UserMessage } from '../types/message';

/**
 * Supported programming languages
 */
export enum ProgrammingLanguage {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  BASH = 'bash',
  RUBY = 'ruby',
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
  language: ProgrammingLanguage | string;
  code: string;
  timeout?: number; // Timeout in milliseconds
  args?: string[]; // Command-line arguments
  workingDirectory?: string; // Working directory for execution
  env?: Record<string, string>; // Environment variables
  memoryLimit?: number; // Memory limit in MB
  useContainer?: boolean; // Whether to use a container for isolation
  containerImage?: string; // Container image to use for isolation
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<CodeExecutionConfig> = {
  timeout: 30000, // 30 seconds default timeout
  args: [],
  env: {},
  memoryLimit: 512, // 512MB default memory limit
  useContainer: false, // Container isolation is off by default
};

/**
 * Action for running code in various languages
 */
export class RunCode extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'RunCode',
      description: config.description || 'Executes code in a controlled environment with sandbox isolation and resource limits',
    });
  }

  /**
   * Runs the RunCode action
   * @returns The execution results
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running RunCode action`);
      
      // Get the last message from memory
      const messages = this.context.memory.get();
      if (!messages || messages.length === 0) {
        return this.createOutput(
          'No messages available',
          'failed'
        );
      }

      // Parse the last message to get code and configuration
      const lastMessage = messages[messages.length - 1];
      let code: string;
      let language: string = ProgrammingLanguage.JAVASCRIPT;

      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(lastMessage.content);
        code = parsed.code;
        language = parsed.language || language;
      } catch {
        // If not JSON, treat the entire message as code
        code = lastMessage.content;
      }

      // Validate code input
      if (!code) {
        return this.createOutput(
          'No code provided for execution. Please provide the code to run.',
          'failed'
        );
      }

      // Execute the code
      const result = await this.executeCode({
        code,
        language,
        timeout: this.getArg<number>('timeout') || DEFAULT_CONFIG.timeout,
        args: this.getArg<string[]>('args') || DEFAULT_CONFIG.args,
        env: this.getArg<Record<string, string>>('env') || DEFAULT_CONFIG.env,
        memoryLimit: this.getArg<number>('memoryLimit') || DEFAULT_CONFIG.memoryLimit,
        useContainer: this.getArg<boolean>('useContainer') || DEFAULT_CONFIG.useContainer,
        containerImage: this.getArg<string>('containerImage'),
      });

      // Generate output
      const formattedResult = this.formatResult(result);
      
      // Determine if execution was successful based on exit code and error presence
      const status = result.success ? 'completed' : 'failed';
      
      return this.createOutput(
        formattedResult,
        status,
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in RunCode action:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to execute code: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Executes code with the given configuration
   * @param config Code execution configuration
   * @returns Execution result
   */
  private async executeCode(config: CodeExecutionConfig): Promise<ExecutionResult> {
    const startTime = Date.now();
    const tempDir = await this.createTempDirectory();
    
    try {
      // Apply default configuration values
      const execConfig = { ...DEFAULT_CONFIG, ...config };
      
      // Prepare code file
      const codeFilePath = await this.writeCodeToFile(tempDir, execConfig.code, execConfig.language);
      
      // Execute based on isolation mode
      const result = execConfig.useContainer 
        ? await this.executeInContainer(codeFilePath, execConfig)
        : await this.executeNatively(codeFilePath, execConfig);
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      return {
        ...result,
        executionTime,
        success: result.exitCode === 0 && !result.error,
      };
    } catch (error) {
      // Handle execution errors
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        executionTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Cleanup temporary directory
      await this.cleanupTempDirectory(tempDir);
    }
  }

  /**
   * Creates a temporary directory for code execution
   * @returns Path to temporary directory
   */
  private async createTempDirectory(): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `runcode-${uuidv4()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Cleans up temporary directory
   * @param tempDir Path to temporary directory
   */
  private async cleanupTempDirectory(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn(`[${this.name}] Failed to cleanup temporary directory:`, error);
    }
  }

  /**
   * Writes code to a file in the temporary directory
   * @param tempDir Path to temporary directory
   * @param code Code to write
   * @param language Programming language
   * @returns Path to code file
   */
  private async writeCodeToFile(tempDir: string, code: string, language: string): Promise<string> {
    // Determine file extension based on language
    const extension = this.getFileExtensionForLanguage(language);
    const filePath = path.join(tempDir, `code${extension}`);
    
    // Write code to file
    await fs.writeFile(filePath, code, 'utf-8');
    
    return filePath;
  }

  /**
   * Gets file extension for a programming language
   * @param language Programming language
   * @returns File extension
   */
  private getFileExtensionForLanguage(language: string): string {
    const extensions: Record<string, string> = {
      [ProgrammingLanguage.JAVASCRIPT]: '.js',
      [ProgrammingLanguage.TYPESCRIPT]: '.ts',
      [ProgrammingLanguage.PYTHON]: '.py',
      [ProgrammingLanguage.BASH]: '.sh',
      [ProgrammingLanguage.RUBY]: '.rb',
    };
    
    return extensions[language.toLowerCase()] || '.txt';
  }

  /**
   * Gets command to execute a file based on its language
   * @param filePath Path to code file
   * @param language Programming language
   * @returns Command to execute
   */
  private getExecutionCommand(filePath: string, language: string): { command: string, args: string[] } {
    const commands: Record<string, { command: string, args: string[] }> = {
      [ProgrammingLanguage.JAVASCRIPT]: { command: 'node', args: [filePath] },
      [ProgrammingLanguage.TYPESCRIPT]: { command: 'ts-node', args: [filePath] },
      [ProgrammingLanguage.PYTHON]: { command: 'python', args: [filePath] },
      [ProgrammingLanguage.BASH]: { command: 'bash', args: [filePath] },
      [ProgrammingLanguage.RUBY]: { command: 'ruby', args: [filePath] },
    };
    
    return commands[language.toLowerCase()] || { command: 'cat', args: [filePath] };
  }

  /**
   * Executes code natively (without container isolation)
   * @param codeFilePath Path to code file
   * @param config Code execution configuration
   * @returns Execution result
   */
  private executeNatively(codeFilePath: string, config: CodeExecutionConfig): Promise<Omit<ExecutionResult, 'executionTime' | 'success'>> {
    return new Promise((resolve) => {
      // Get execution command
      const { command, args: cmdArgs } = this.getExecutionCommand(codeFilePath, config.language);
      const allArgs = [...cmdArgs, ...(config.args || [])];
      
      // Prepare environment variables
      const env = { ...process.env, ...(config.env || {}) };

      // Prepare execution options
      const options: childProcess.SpawnOptions = {
        cwd: config.workingDirectory || path.dirname(codeFilePath),
        env,
        timeout: config.timeout,
        stdio: 'pipe',
        shell: true,
      };

      // Start process
      const proc = childProcess.spawn(command, allArgs, options);
      
      // Collect output
      let stdout = '';
      let stderr = '';
      
      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }
      
      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }
      
      // Handle process exit
      proc.on('close', (exitCode) => {
        resolve({
          stdout,
          stderr,
          exitCode: exitCode !== null ? exitCode : 1,
        });
      });
      
      // Handle process error
      proc.on('error', (error) => {
        resolve({
          stdout,
          stderr: error.message,
          exitCode: 1,
          error: error.message,
        });
      });
      
      // Handle timeout
      if (config.timeout) {
        setTimeout(() => {
          // Kill process if it's still running
          if (proc.connected) {
            proc.kill();
            resolve({
              stdout,
              stderr: 'Execution timed out',
              exitCode: 124, // Standard timeout exit code
              error: 'Execution timed out',
            });
          }
        }, config.timeout);
      }
    });
  }

  /**
   * Executes code in a container for isolation
   * @param codeFilePath Path to code file
   * @param config Code execution configuration
   * @returns Execution result
   */
  private async executeInContainer(codeFilePath: string, config: CodeExecutionConfig): Promise<Omit<ExecutionResult, 'executionTime' | 'success'>> {
    // If Docker is not available, fallback to native execution
    if (!await this.isDockerAvailable()) {
      logger.warn(`[${this.name}] Docker not available, falling back to native execution`);
      return this.executeNatively(codeFilePath, config);
    }
    
    // Get container image based on language
    const image = config.containerImage || this.getDefaultContainerImage(config.language);
    
    // Prepare Docker run command
    const fileName = path.basename(codeFilePath);
    const containerPath = `/app/${fileName}`;
    
    // Build Docker command
    const dockerArgs = [
      'run',
      '--rm',
      // Set memory limit if specified
      ...(config.memoryLimit ? [`--memory=${config.memoryLimit}m`] : []),
      // Set environment variables
      ...Object.entries(config.env || {}).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
      // Mount the code file
      '-v', `${codeFilePath}:${containerPath}:ro`,
      // Set working directory
      '-w', '/app',
      // Set container image
      image,
    ];
    
    // Get execution command
    const { command, args: cmdArgs } = this.getExecutionCommandForContainer(containerPath, config.language);
    const allArgs = [...dockerArgs, command, ...cmdArgs, ...(config.args || [])];
    
    return new Promise((resolve) => {
      // Run Docker container
      const proc = childProcess.spawn('docker', allArgs, {
        timeout: config.timeout,
        stdio: 'pipe',
      });
      
      // Collect output
      let stdout = '';
      let stderr = '';
      
      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }
      
      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }
      
      // Handle process exit
      proc.on('close', (exitCode) => {
        resolve({
          stdout,
          stderr,
          exitCode: exitCode !== null ? exitCode : 1,
        });
      });
      
      // Handle process error
      proc.on('error', (error) => {
        resolve({
          stdout,
          stderr: error.message,
          exitCode: 1,
          error: error.message,
        });
      });
      
      // Handle timeout
      if (config.timeout) {
        setTimeout(() => {
          // Kill process if it's still running
          if (proc.connected) {
            proc.kill();
            resolve({
              stdout,
              stderr: 'Execution timed out',
              exitCode: 124, // Standard timeout exit code
              error: 'Execution timed out',
            });
          }
        }, config.timeout);
      }
    });
  }

  /**
   * Gets execution command for container
   * @param containerPath Path to code file in container
   * @param language Programming language
   * @returns Command to execute
   */
  private getExecutionCommandForContainer(containerPath: string, language: string): { command: string, args: string[] } {
    const commands: Record<string, { command: string, args: string[] }> = {
      [ProgrammingLanguage.JAVASCRIPT]: { command: 'node', args: [containerPath] },
      [ProgrammingLanguage.TYPESCRIPT]: { command: 'ts-node', args: [containerPath] },
      [ProgrammingLanguage.PYTHON]: { command: 'python', args: [containerPath] },
      [ProgrammingLanguage.BASH]: { command: 'bash', args: [containerPath] },
      [ProgrammingLanguage.RUBY]: { command: 'ruby', args: [containerPath] },
    };
    
    return commands[language.toLowerCase()] || { command: 'cat', args: [containerPath] };
  }

  /**
   * Gets default container image for a programming language
   * @param language Programming language
   * @returns Container image name
   */
  private getDefaultContainerImage(language: string): string {
    const images: Record<string, string> = {
      [ProgrammingLanguage.JAVASCRIPT]: 'node:lts-alpine',
      [ProgrammingLanguage.TYPESCRIPT]: 'node:lts-alpine',
      [ProgrammingLanguage.PYTHON]: 'python:3-alpine',
      [ProgrammingLanguage.BASH]: 'alpine:latest',
      [ProgrammingLanguage.RUBY]: 'ruby:alpine',
    };
    
    return images[language.toLowerCase()] || 'alpine:latest';
  }

  /**
   * Checks if Docker is available
   * @returns True if Docker is available
   */
  private async isDockerAvailable(): Promise<boolean> {
    try {
      return new Promise((resolve) => {
        const proc = childProcess.spawn('docker', ['--version'], {
          timeout: 2000,
          stdio: 'ignore',
        });
        
        proc.on('close', (exitCode) => {
          resolve(exitCode === 0);
        });
        
        proc.on('error', () => {
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Formats execution result into human-readable text
   * @param result Execution result
   * @returns Formatted result text
   */
  private formatResult(result: ExecutionResult): string {
    const status = result.success ? 'SUCCESS' : 'FAILURE';
    const executionTimeStr = `${result.executionTime / 1000} seconds`;
    
    let output = `# Code Execution Result: ${status}\n\n`;
    output += `**Execution Time:** ${executionTimeStr}\n`;
    output += `**Exit Code:** ${result.exitCode}\n\n`;
    
    if (result.stdout) {
      output += `## Standard Output\n\`\`\`\n${result.stdout}\n\`\`\`\n\n`;
    } else {
      output += `## Standard Output\n*(No output)*\n\n`;
    }
    
    if (result.stderr) {
      output += `## Standard Error\n\`\`\`\n${result.stderr}\n\`\`\`\n\n`;
    }
    
    if (result.error) {
      output += `## Error\n\`\`\`\n${result.error}\n\`\`\`\n\n`;
    }
    
    return output;
  }
} 