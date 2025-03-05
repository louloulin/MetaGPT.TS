/**
 * @module RunCommand
 * @category CLI Commands
 * @description Command to run MetaGPT code
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Command } from '../command';
import type { CommandArguments, CommandOptions, CommandContext, CommandMeta } from '../command';
import { logger } from '../../utils/logger';

/**
 * Command to run MetaGPT code
 */
export class RunCommand extends Command {
  /**
   * Create a new run command
   */
  constructor() {
    const meta: CommandMeta = {
      name: 'run',
      description: 'Run MetaGPT code',
      aliases: ['r', 'execute'],
      examples: [
        'metagpt run script.ts',
        'metagpt run script.js --debug',
        'metagpt run --interactive',
      ],
      category: 'Execution',
    };
    
    super(meta);
  }
  
  /**
   * Execute the command
   * @param args Command arguments
   * @param options Command options
   * @param context Command context
   * @returns Promise that resolves when the command completes
   */
  public async execute(
    args: CommandArguments,
    options: CommandOptions,
    context: CommandContext
  ): Promise<void> {
    // Get script file
    const scriptFile = args['0'] as string;
    
    // Check for interactive mode
    const isInteractive = options.interactive === true || options.i === true;
    
    // Check for debug mode
    const isDebug = options.debug === true || options.d === true;
    
    if (isInteractive) {
      await this.runInteractive(context, isDebug);
      return;
    }
    
    if (!scriptFile) {
      context.output('No script file provided', 'error');
      context.output('Usage: metagpt run <script.ts|js> [options]', 'info');
      context.output('       metagpt run --interactive', 'info');
      return;
    }
    
    // Check if file exists
    const filePath = path.resolve(context.cwd, scriptFile);
    try {
      await fs.access(filePath);
    } catch (error) {
      context.output(`File not found: ${scriptFile}`, 'error');
      return;
    }
    
    // Display info message
    context.output(`Running ${scriptFile}...`, 'info');
    
    if (isDebug) {
      context.output('Debug mode enabled', 'info');
      process.env.DEBUG = 'true';
    }
    
    try {
      // Track execution time
      const startTime = Date.now();
      
      // Execute script
      await this.executeScript(filePath, context);
      
      // Display completion message
      const executionTime = Date.now() - startTime;
      context.output(`\nExecution completed in ${executionTime}ms`, 'success');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.output(`\nExecution failed: ${errorMessage}`, 'error');
      if (isDebug && error instanceof Error) {
        context.output(error.stack || '', 'error');
      }
    }
  }
  
  /**
   * Execute a script
   * @param filePath Script file path
   * @param context Command context
   */
  private async executeScript(filePath: string, context: CommandContext): Promise<void> {
    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    
    // Check extension
    if (ext === '.ts') {
      // Execute TypeScript file
      await this.executeTypeScript(filePath, context);
    } else if (ext === '.js') {
      // Execute JavaScript file
      await this.executeJavaScript(filePath, context);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  }
  
  /**
   * Execute a TypeScript file
   * @param filePath Script file path
   * @param context Command context
   */
  private async executeTypeScript(filePath: string, context: CommandContext): Promise<void> {
    try {
      // Try to load ts-node
      require('ts-node/register');
    } catch (error) {
      context.output('ts-node is not installed. Installing...', 'info');
      
      try {
        // Dynamically install ts-node
        const { execSync } = require('child_process');
        execSync('npm install --no-save ts-node typescript', { stdio: 'inherit' });
        
        // Load ts-node again
        require('ts-node/register');
      } catch (installError) {
        throw new Error(`Failed to install ts-node: ${installError}`);
      }
    }
    
    // Execute TypeScript file
    try {
      require(filePath);
    } catch (error) {
      throw new Error(`Error executing TypeScript file: ${error}`);
    }
  }
  
  /**
   * Execute a JavaScript file
   * @param filePath Script file path
   * @param context Command context
   */
  private async executeJavaScript(filePath: string, context: CommandContext): Promise<void> {
    try {
      require(filePath);
    } catch (error) {
      throw new Error(`Error executing JavaScript file: ${error}`);
    }
  }
  
  /**
   * Run in interactive mode
   * @param context Command context
   * @param isDebug Debug mode
   */
  private async runInteractive(context: CommandContext, isDebug: boolean): Promise<void> {
    context.output('Starting interactive MetaGPT session...', 'info');
    
    if (isDebug) {
      context.output('Debug mode enabled', 'info');
      process.env.DEBUG = 'true';
    }
    
    // Try to load the REPL module
    const repl = require('repl');
    
    try {
      // Try to load ts-node for TypeScript support
      require('ts-node/register');
      context.output('TypeScript support enabled', 'info');
    } catch (error) {
      context.output('TypeScript support not available (ts-node not installed)', 'warn');
    }
    
    context.output('\nMetaGPT-TS Interactive Shell', 'info');
    context.output('Type ".help" for more information', 'info');
    
    // Create REPL
    const replServer = repl.start({
      prompt: 'metagpt> ',
      useColors: true,
      breakEvalOnSigint: true,
    });
    
    // Load MetaGPT modules
    replServer.context.metagpt = require('../../index');
    
    // Add special commands
    replServer.defineCommand('clear', {
      help: 'Clear the terminal screen',
      action() {
        console.clear();
        this.displayPrompt();
      },
    });
    
    replServer.defineCommand('debug', {
      help: 'Toggle debug mode',
      action() {
        if (process.env.DEBUG === 'true') {
          process.env.DEBUG = 'false';
          console.log('Debug mode disabled');
        } else {
          process.env.DEBUG = 'true';
          console.log('Debug mode enabled');
        }
        this.displayPrompt();
      },
    });
    
    // Handle REPL exit
    replServer.on('exit', () => {
      context.output('\nExiting interactive session', 'info');
    });
  }
} 