/**
 * @module Command
 * @category CLI
 * @description Base command interfaces and classes for the MetaGPT CLI
 */

import { z } from 'zod';
import { logger } from '../utils/logger';

/**
 * Base interface for command options
 */
export interface CommandOptions {
  [key: string]: any;
}

/**
 * Base interface for command arguments
 */
export interface CommandArguments {
  [key: string]: any;
}

/**
 * Command execution context
 */
export interface CommandContext {
  /** Current working directory */
  cwd: string;
  /** Environment variables */
  env: Record<string, string>;
  /** Output handler */
  output: (text: string, type?: 'info' | 'error' | 'warn' | 'debug' | 'success') => void;
  /** User input handler */
  input: (prompt: string, options?: { password?: boolean }) => Promise<string>;
  /** Progress handler */
  progress: (total: number) => { update: (value: number) => void; complete: () => void };
}

/**
 * Command metadata interface
 */
export interface CommandMeta {
  /** Command name */
  name: string;
  /** Command description */
  description: string;
  /** Command aliases */
  aliases?: string[];
  /** Command examples */
  examples?: string[];
  /** Command category */
  category?: string;
}

/**
 * Base interface for all commands
 */
export interface ICommand {
  /** Command metadata */
  meta: CommandMeta;
  
  /** 
   * Execute the command
   * @param args Command arguments
   * @param options Command options
   * @param context Command context
   */
  execute(args: CommandArguments, options: CommandOptions, context: CommandContext): Promise<void>;
  
  /**
   * Get command help text
   */
  getHelp(): string;
}

/**
 * Abstract base command class
 */
export abstract class Command implements ICommand {
  /** Command metadata */
  public readonly meta: CommandMeta;
  
  /**
   * Create a new command
   * @param meta Command metadata
   */
  constructor(meta: CommandMeta) {
    this.meta = meta;
  }
  
  /**
   * Execute the command
   * @param args Command arguments
   * @param options Command options
   * @param context Command context
   */
  abstract execute(args: CommandArguments, options: CommandOptions, context: CommandContext): Promise<void>;
  
  /**
   * Get command help text
   */
  getHelp(): string {
    const { name, description, aliases, examples } = this.meta;
    
    let help = `\n${name} - ${description}\n\n`;
    
    if (aliases && aliases.length > 0) {
      help += `Aliases: ${aliases.join(', ')}\n\n`;
    }
    
    if (examples && examples.length > 0) {
      help += 'Examples:\n';
      examples.forEach(example => {
        help += `  ${example}\n`;
      });
      help += '\n';
    }
    
    return help;
  }
  
  /**
   * Log message using the context output or fallback to logger
   * @param message Message to log
   * @param type Message type
   * @param context Command context
   */
  protected log(message: string, type: 'info' | 'error' | 'warn' | 'debug' | 'success' = 'info', context?: CommandContext): void {
    if (context && context.output) {
      context.output(message, type);
    } else {
      switch (type) {
        case 'error':
          logger.error(message);
          break;
        case 'warn':
          logger.warn(message);
          break;
        case 'debug':
          logger.debug(message);
          break;
        case 'success':
        case 'info':
        default:
          logger.info(message);
          break;
      }
    }
  }
} 