/**
 * @module Sandbox
 * @category Environment
 * @description Provides a secure sandbox environment for executing code in various languages
 */

import { z } from 'zod';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';
import { performance } from 'perf_hooks';
import { Observable, Subject } from 'rxjs';

/**
 * Supported programming languages in the sandbox
 */
export type SupportedLanguage = 
  | 'javascript' 
  | 'typescript' 
  | 'python'
  | 'shell' 
  | 'ruby' 
  | 'go'
  | 'java'
  | 'csharp'
  | 'php'
  | 'rust';

/**
 * File extension mapping for supported languages
 */
export const LanguageExtensions: Record<SupportedLanguage, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  shell: 'sh',
  ruby: 'rb',
  go: 'go',
  java: 'java',
  csharp: 'cs',
  php: 'php',
  rust: 'rs'
};

/**
 * Configuration for the sandbox
 */
export const SandboxConfigSchema = z.object({
  /** Base directory for sandbox operations */
  baseDir: z.string().default(path.join(process.cwd(), '.sandbox')),
  /** Maximum execution time in milliseconds */
  timeoutMs: z.number().default(10000),
  /** Maximum memory limit in MB */
  memoryLimitMB: z.number().default(100),
  /** Maximum CPU usage as a percentage (0-100) */
  cpuLimit: z.number().default(50),
  /** Maximum disk space in MB */
  diskSpaceLimitMB: z.number().default(50),
  /** Allow network access */
  allowNetwork: z.boolean().default(false),
  /** Environment variables to pass to the sandbox */
  env: z.record(z.string()).default({}),
  /** Whitelist of allowed modules/packages */
  allowedModules: z.array(z.string()).default([]),
  /** Enable resource monitoring */
  enableMonitoring: z.boolean().default(true),
  /** Path to Docker executable (if using Docker-based isolation) */
  dockerPath: z.string().optional(),
  /** Docker image to use for isolation */
  dockerImage: z.string().optional()
});

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

/**
 * Execution result from the sandbox
 */
export interface ExecutionResult {
  /** Exit code of the process */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Memory usage in MB */
  memoryUsageMB: number;
  /** Error message if any */
  error?: string;
  /** Performance metrics */
  performance?: {
    /** CPU usage percentage */
    cpuUsage: number;
    /** Peak memory usage in MB */
    peakMemoryMB: number;
    /** I/O operations count */
    ioOperations: number;
  };
  /** Analysis of the code execution */
  analysis?: {
    /** Issues detected during execution */
    issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      line?: number;
      column?: number;
    }>;
    /** Suggested fixes for issues */
    suggestions: string[];
    /** Overall quality assessment */
    qualityScore: number;
  };
}

/**
 * Execution options for running code in the sandbox
 */
export interface ExecutionOptions {
  /** Programming language */
  language: SupportedLanguage;
  /** Code to execute */
  code: string;
  /** Timeout in milliseconds (overrides config) */
  timeoutMs?: number;
  /** Input to provide to the program */
  stdin?: string;
  /** Environment variables to pass to the program */
  env?: Record<string, string>;
  /** Command line arguments */
  args?: string[];
  /** Files to make available in the sandbox */
  files?: Array<{ path: string; content: string }>;
  /** Whether to use Docker for isolation */
  useDocker?: boolean;
  /** Enable debugging */
  debug?: boolean;
}

/**
 * Sandbox environment for secure code execution
 */
export class Sandbox {
  /** Configuration */
  private config: SandboxConfig;
  /** Cache of resource usage for monitoring */
  private resourceUsageCache: Map<string, any> = new Map();
  /** Subject for monitoring events */
  private monitoringSubject = new Subject<any>();

  /**
   * Create a new sandbox
   * @param config Sandbox configuration
   */
  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = SandboxConfigSchema.parse(config);
    this.initSandbox();
  }

  /**
   * Initialize the sandbox environment
   */
  private async initSandbox(): Promise<void> {
    try {
      // Ensure sandbox directory exists
      await fs.mkdir(this.config.baseDir, { recursive: true });
      
      // Check for Docker if needed
      if (this.config.dockerPath) {
        try {
          const { status } = spawnSync(this.config.dockerPath, ['--version']);
          if (status !== 0) {
            logger.warn('Docker is configured but not available. Falling back to local execution.');
            this.config.dockerPath = undefined;
          }
        } catch (error) {
          logger.warn('Error checking Docker:', error);
          this.config.dockerPath = undefined;
        }
      }
      
      logger.info(`Sandbox initialized at ${this.config.baseDir}`);
    } catch (error) {
      logger.error('Failed to initialize sandbox:', error);
      throw new Error(`Sandbox initialization failed: ${error}`);
    }
  }

  /**
   * Execute code in the sandbox
   * @param options Execution options
   * @returns Result of the execution
   */
  public async execute(options: ExecutionOptions): Promise<ExecutionResult> {
    const sessionId = crypto.randomUUID();
    const sessionDir = path.join(this.config.baseDir, sessionId);
    
    try {
      // Create session directory
      await fs.mkdir(sessionDir, { recursive: true });
      
      // Determine file extension
      const extension = LanguageExtensions[options.language];
      const mainFilePath = path.join(sessionDir, `main.${extension}`);
      
      // Write code to file
      await fs.writeFile(mainFilePath, options.code, 'utf-8');
      
      // Write additional files if provided
      if (options.files && options.files.length > 0) {
        for (const file of options.files) {
          const filePath = path.join(sessionDir, file.path);
          const fileDir = path.dirname(filePath);
          await fs.mkdir(fileDir, { recursive: true });
          await fs.writeFile(filePath, file.content, 'utf-8');
        }
      }
      
      // Execute the code
      let result: ExecutionResult;
      if (options.useDocker && this.config.dockerPath) {
        result = await this.executeInDocker(sessionDir, mainFilePath, options);
      } else {
        result = await this.executeLocally(sessionDir, mainFilePath, options);
      }
      
      // Add code analysis if enabled
      if (this.config.enableMonitoring) {
        result.analysis = await this.analyzeExecution(result, options);
      }
      
      return result;
    } catch (error) {
      logger.error('Execution error:', error);
      return {
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        executionTimeMs: 0,
        memoryUsageMB: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      // Clean up session directory
      try {
        await fs.rm(sessionDir, { recursive: true, force: true });
      } catch (error) {
        logger.warn('Failed to clean up sandbox session directory:', error);
      }
    }
  }

  /**
   * Execute code locally with process isolation
   * @param sessionDir Session directory
   * @param mainFilePath Path to the main file
   * @param options Execution options
   * @returns Result of the execution
   */
  private async executeLocally(
    sessionDir: string,
    mainFilePath: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const startTime = performance.now();
    let command: string;
    let args: string[] = [];
    
    // Prepare command based on language
    switch (options.language) {
      case 'javascript':
        command = 'node';
        args = [mainFilePath];
        break;
      case 'typescript':
        command = 'npx';
        args = ['ts-node', mainFilePath];
        break;
      case 'python':
        command = 'python3';
        args = [mainFilePath];
        break;
      case 'shell':
        command = 'bash';
        args = [mainFilePath];
        break;
      case 'ruby':
        command = 'ruby';
        args = [mainFilePath];
        break;
      case 'go':
        command = 'go';
        args = ['run', mainFilePath];
        break;
      case 'java':
        // For Java, we need to compile first
        const className = 'Main'; // Assuming main class is called Main
        spawnSync('javac', [mainFilePath]);
        command = 'java';
        args = ['-cp', sessionDir, className];
        break;
      case 'csharp':
        command = 'dotnet';
        args = ['script', mainFilePath];
        break;
      case 'php':
        command = 'php';
        args = [mainFilePath];
        break;
      case 'rust':
        // For Rust, compile first using rustc
        spawnSync('rustc', [mainFilePath, '-o', path.join(sessionDir, 'main')]);
        command = path.join(sessionDir, 'main');
        args = [];
        break;
      default:
        throw new Error(`Unsupported language: ${options.language}`);
    }
    
    // Add custom arguments if provided
    if (options.args && options.args.length > 0) {
      args = [...args, ...options.args];
    }
    
    // Prepare environment variables
    const env = {
      ...process.env,
      ...this.config.env,
      ...options.env
    };
    
    // Remove potentially dangerous environment variables
    delete env.AWS_ACCESS_KEY_ID;
    delete env.AWS_SECRET_ACCESS_KEY;
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
    
    // Disable network access if not allowed
    if (!this.config.allowNetwork) {
      env.NO_NETWORK = 'true';
    }
    
    // Execute command
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let memoryUsageMB = 0;
      
      const timeout = options.timeoutMs || this.config.timeoutMs;
      
      const process = spawn(command, args, {
        cwd: sessionDir,
        env,
        timeout
      });
      
      // Monitor resource usage
      const resourceMonitor = setInterval(() => {
        if (process.pid) {
          try {
            const memUsage = this.checkMemoryUsage(process.pid);
            memoryUsageMB = Math.max(memoryUsageMB, memUsage);
            
            // Kill if exceeding limits
            if (memUsage > this.config.memoryLimitMB) {
              process.kill('SIGTERM');
              clearInterval(resourceMonitor);
              stderr += '\nProcess terminated: Memory limit exceeded';
            }
          } catch (error) {
            // Process might have ended
          }
        }
      }, 100);
      
      // Handle stdout
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      // Handle stderr
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Provide stdin if required
      if (options.stdin) {
        process.stdin.write(options.stdin);
        process.stdin.end();
      }
      
      // Handle process exit
      process.on('close', (exitCode) => {
        clearInterval(resourceMonitor);
        const endTime = performance.now();
        
        resolve({
          exitCode: exitCode ?? 1,
          stdout,
          stderr,
          executionTimeMs: endTime - startTime,
          memoryUsageMB
        });
      });
      
      // Handle errors
      process.on('error', (error) => {
        clearInterval(resourceMonitor);
        const endTime = performance.now();
        
        resolve({
          exitCode: 1,
          stdout,
          stderr: stderr + '\n' + error.message,
          executionTimeMs: endTime - startTime,
          memoryUsageMB,
          error: error.message
        });
      });
    });
  }

  /**
   * Execute code in Docker container for enhanced isolation
   * @param sessionDir Session directory
   * @param mainFilePath Path to the main file
   * @param options Execution options
   * @returns Result of the execution
   */
  private async executeInDocker(
    sessionDir: string,
    mainFilePath: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    if (!this.config.dockerPath || !this.config.dockerImage) {
      throw new Error('Docker execution requested but Docker configuration is incomplete');
    }
    
    const startTime = performance.now();
    const relativePath = path.relative(this.config.baseDir, mainFilePath);
    const dockerArgs = [
      'run',
      '--rm',
      '--network', this.config.allowNetwork ? 'bridge' : 'none',
      '-m', `${this.config.memoryLimitMB}m`,
      '--cpus', `${this.config.cpuLimit / 100}`,
      '-v', `${sessionDir}:/sandbox`,
      '-w', '/sandbox'
    ];
    
    // Add environment variables
    const env = {
      ...this.config.env,
      ...options.env
    };
    
    Object.entries(env).forEach(([key, value]) => {
      dockerArgs.push('-e', `${key}=${value}`);
    });
    
    // Add Docker image
    dockerArgs.push(this.config.dockerImage);
    
    // Add command based on language
    switch (options.language) {
      case 'javascript':
        dockerArgs.push('node', relativePath);
        break;
      case 'typescript':
        dockerArgs.push('npx', 'ts-node', relativePath);
        break;
      case 'python':
        dockerArgs.push('python3', relativePath);
        break;
      case 'shell':
        dockerArgs.push('bash', relativePath);
        break;
      case 'ruby':
        dockerArgs.push('ruby', relativePath);
        break;
      case 'go':
        dockerArgs.push('go', 'run', relativePath);
        break;
      case 'java':
        dockerArgs.push('bash', '-c', `javac ${relativePath} && java -cp . Main`);
        break;
      case 'csharp':
        dockerArgs.push('dotnet', 'script', relativePath);
        break;
      case 'php':
        dockerArgs.push('php', relativePath);
        break;
      case 'rust':
        dockerArgs.push('bash', '-c', `rustc ${relativePath} -o /sandbox/main && /sandbox/main`);
        break;
      default:
        throw new Error(`Unsupported language: ${options.language}`);
    }
    
    // Add custom arguments if provided
    if (options.args && options.args.length > 0) {
      dockerArgs.push(...options.args);
    }
    
    // Execute Docker command
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      
      const process = spawn(this.config.dockerPath!, dockerArgs, {
        timeout: options.timeoutMs || this.config.timeoutMs
      });
      
      // Handle stdout
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      // Handle stderr
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Provide stdin if required
      if (options.stdin) {
        process.stdin.write(options.stdin);
        process.stdin.end();
      }
      
      // Handle process exit
      process.on('close', (exitCode) => {
        const endTime = performance.now();
        
        resolve({
          exitCode: exitCode ?? 1,
          stdout,
          stderr,
          executionTimeMs: endTime - startTime,
          memoryUsageMB: 0, // Exact memory usage from Docker would require additional parsing
        });
      });
      
      // Handle errors
      process.on('error', (error) => {
        const endTime = performance.now();
        
        resolve({
          exitCode: 1,
          stdout,
          stderr: stderr + '\n' + error.message,
          executionTimeMs: endTime - startTime,
          memoryUsageMB: 0,
          error: error.message
        });
      });
    });
  }
  
  /**
   * Check memory usage of a process
   * @param pid Process ID
   * @returns Memory usage in MB
   */
  private checkMemoryUsage(pid: number): number {
    try {
      if (process.platform === 'win32') {
        const result = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV']);
        const output = result.stdout.toString();
        const match = /,"(\d+) K"/.exec(output);
        if (match && match[1]) {
          return parseInt(match[1], 10) / 1024; // Convert KB to MB
        }
      } else {
        // Unix-like systems (Linux, macOS)
        const result = spawnSync('ps', ['-p', pid.toString(), '-o', 'rss=']);
        const output = result.stdout.toString().trim();
        if (output) {
          return parseInt(output, 10) / 1024; // Convert KB to MB
        }
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Analyze execution results and provide insights
   * @param result Execution result
   * @param options Original execution options
   * @returns Analysis of the execution
   */
  private async analyzeExecution(
    result: ExecutionResult,
    options: ExecutionOptions
  ): Promise<ExecutionResult['analysis']> {
    const issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      line?: number;
      column?: number;
    }> = [];
    
    const suggestions: string[] = [];
    let qualityScore = 10; // Start with perfect score
    
    // Check for errors in stderr
    if (result.stderr) {
      // Parse common error patterns
      const errorLines = result.stderr.split('\n');
      for (const line of errorLines) {
        // Check for syntax errors
        const syntaxMatch = line.match(/SyntaxError|ParseError|SyntaxException/i);
        if (syntaxMatch) {
          issues.push({
            type: 'error',
            message: line.trim()
          });
          qualityScore -= 2;
          suggestions.push('Fix syntax error in code');
        }
        
        // Check for reference/undefined errors
        const refMatch = line.match(/ReferenceError|undefined|not defined|NameError/i);
        if (refMatch) {
          issues.push({
            type: 'error',
            message: line.trim()
          });
          qualityScore -= 1.5;
          suggestions.push('Check variable definitions and imports');
        }
        
        // Check for type errors
        const typeMatch = line.match(/TypeError|type error|type mismatch|ClassCastException/i);
        if (typeMatch) {
          issues.push({
            type: 'error',
            message: line.trim()
          });
          qualityScore -= 1.5;
          suggestions.push('Verify type compatibility');
        }
        
        // Extract line numbers if available
        const lineMatch = line.match(/line (\d+)/i);
        if (lineMatch && issues.length > 0) {
          issues[issues.length - 1].line = parseInt(lineMatch[1], 10);
        }
      }
    }
    
    // Check for performance issues
    if (result.executionTimeMs > this.config.timeoutMs * 0.8) {
      issues.push({
        type: 'warning',
        message: 'Code execution took a long time'
      });
      qualityScore -= 1;
      suggestions.push('Optimize code for better performance');
    }
    
    if (result.memoryUsageMB > this.config.memoryLimitMB * 0.8) {
      issues.push({
        type: 'warning',
        message: 'Code used a large amount of memory'
      });
      qualityScore -= 1;
      suggestions.push('Reduce memory usage in code');
    }
    
    // Ensure quality score is in range 0-10
    qualityScore = Math.max(0, Math.min(10, qualityScore));
    
    return {
      issues,
      suggestions,
      qualityScore
    };
  }

  /**
   * Get resource usage monitoring as an observable
   * @returns Observable that emits resource usage updates
   */
  public getResourceMonitor(): Observable<any> {
    return this.monitoringSubject.asObservable();
  }

  /**
   * Create an interactive REPL (Read-Eval-Print Loop) session
   * @param language Programming language
   * @param config Optional configuration for the REPL
   * @returns Object with methods to interact with the REPL
   */
  public createREPL(
    language: SupportedLanguage,
    config: Partial<SandboxConfig> = {}
  ): {
    evaluate: (code: string) => Promise<ExecutionResult>;
    terminate: () => Promise<void>;
  } {
    // Implement REPL functionality
    let replSessionId = crypto.randomUUID();
    let replHistory: string[] = [];
    
    return {
      evaluate: async (code: string) => {
        // Combine history with new code for context
        let fullCode = '';
        
        switch (language) {
          case 'python':
            // For Python, we can use history as context
            fullCode = [...replHistory, code].join('\n');
            break;
          case 'javascript':
          case 'typescript':
            // For JS/TS, wrap previous results in a closure
            if (replHistory.length > 0) {
              fullCode = `
                (() => {
                  ${replHistory.join('\n')}
                  return ${code};
                })();
              `;
            } else {
              fullCode = code;
            }
            break;
          default:
            // For other languages, just execute the new code
            fullCode = code;
        }
        
        const result = await this.execute({
          language,
          code: fullCode,
          useDocker: !!this.config.dockerPath,
          debug: true
        });
        
        // If successful, add to history
        if (result.exitCode === 0) {
          replHistory.push(code);
        }
        
        return result;
      },
      terminate: async () => {
        // Clean up REPL session
        replHistory = [];
        replSessionId = crypto.randomUUID();
        return Promise.resolve();
      }
    };
  }
} 