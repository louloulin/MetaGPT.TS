/**
 * @module CLIManager
 * @category CLI
 * @description Manages the command line interface for MetaGPT
 */

import { z } from 'zod';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Command } from './command';
import type { ICommand, CommandArguments, CommandOptions, CommandContext } from './command';
import * as readline from 'readline';
import * as os from 'os';
import chalk from 'chalk';

/**
 * Configuration for the CLI Manager
 */
export const CLIManagerConfigSchema = z.object({
  /** Application name */
  appName: z.string().default('metagpt'),
  /** Application version */
  appVersion: z.string().default('0.1.0'),
  /** Command history file path */
  historyFile: z.string().default(path.join(os.homedir(), '.metagpt_history')),
  /** Maximum history entries to keep */
  maxHistoryEntries: z.number().default(1000),
  /** Enable interactive mode */
  interactive: z.boolean().default(false),
  /** Enable auto-completion */
  enableAutoCompletion: z.boolean().default(true),
  /** Configuration file path */
  configFile: z.string().default(path.join(os.homedir(), '.metagpt_config.json')),
  /** Debug mode */
  debug: z.boolean().default(false),
});

export type CLIManagerConfig = z.infer<typeof CLIManagerConfigSchema>;

/**
 * CLI Manager class for MetaGPT
 */
export class CLIManager {
  /** Configuration */
  private config: CLIManagerConfig;
  /** Registered commands */
  private commands: Map<string, ICommand> = new Map();
  /** Command aliases */
  private aliases: Map<string, string> = new Map();
  /** Command history */
  private history: string[] = [];
  /** Interactive mode readline interface */
  private rl?: readline.Interface;
  /** User configuration */
  private userConfig: Record<string, any> = {};
  /** Command context */
  private context: CommandContext;
  
  /**
   * Create a new CLI Manager
   * @param config Configuration
   */
  constructor(config: Partial<CLIManagerConfig> = {}) {
    this.config = CLIManagerConfigSchema.parse(config);
    
    // Initialize command context
    this.context = {
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
      output: this.output.bind(this),
      input: this.input.bind(this),
      progress: this.createProgressBar.bind(this),
    };
    
    // Load history and config
    this.loadHistory().catch(err => logger.warn('Failed to load command history:', err));
    this.loadConfig().catch(err => logger.warn('Failed to load configuration:', err));
  }
  
  /**
   * Register a command
   * @param command Command instance
   */
  public registerCommand(command: ICommand): void {
    const { name, aliases } = command.meta;
    
    // Register command
    this.commands.set(name, command);
    logger.debug(`Registered command: ${name}`);
    
    // Register aliases
    if (aliases) {
      for (const alias of aliases) {
        this.aliases.set(alias, name);
        logger.debug(`Registered alias: ${alias} -> ${name}`);
      }
    }
  }
  
  /**
   * Register multiple commands
   * @param commands Commands to register
   */
  public registerCommands(commands: ICommand[]): void {
    for (const command of commands) {
      this.registerCommand(command);
    }
  }
  
  /**
   * Run a command by name
   * @param name Command name or alias
   * @param args Command arguments
   * @param options Command options
   * @returns Promise that resolves when the command completes
   */
  public async runCommand(name: string, args: CommandArguments = {}, options: CommandOptions = {}): Promise<void> {
    // Check if it's an alias
    if (this.aliases.has(name)) {
      name = this.aliases.get(name)!;
    }
    
    // Get command
    const command = this.commands.get(name);
    if (!command) {
      this.output(`Unknown command: ${name}`, 'error');
      this.showHelp();
      return;
    }
    
    try {
      // Add command to history
      this.addToHistory(`${name} ${this.argsToString(args)} ${this.optionsToString(options)}`);
      
      // Execute command
      await command.execute(args, options, this.context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.output(`Error executing command ${name}: ${errorMessage}`, 'error');
      if (this.config.debug) {
        console.error(error);
      }
    }
  }
  
  /**
   * Start the CLI
   * @param args Command line arguments
   */
  public async start(args: string[] = process.argv.slice(2)): Promise<void> {
    // Show banner
    this.showBanner();
    
    // Check for interactive mode
    if (args.includes('--interactive') || args.includes('-i') || this.config.interactive) {
      await this.startInteractiveMode();
      return;
    }
    
    // Check for version flag
    if (args.includes('--version') || args.includes('-v')) {
      this.output(`${this.config.appName} v${this.config.appVersion}`);
      return;
    }
    
    // Check for help flag
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      this.showHelp();
      return;
    }
    
    // Parse command and arguments
    const [commandName, ...commandArgs] = args;
    const { args: parsedArgs, options } = this.parseArgs(commandArgs);
    
    // Run command
    await this.runCommand(commandName, parsedArgs, options);
  }
  
  /**
   * Start interactive mode
   */
  private async startInteractiveMode(): Promise<void> {
    this.output(`Starting interactive mode. Type 'exit' or 'quit' to exit.`, 'info');
    this.output(`Type 'help' to see available commands.`, 'info');
    
    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${chalk.green('metagpt')}> `,
      historySize: this.config.maxHistoryEntries,
      completer: this.config.enableAutoCompletion ? this.autoCompleter.bind(this) : undefined,
    });
    
    // Set up readline events
    this.rl.on('line', async (line) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        this.rl!.prompt();
        return;
      }
      
      // Handle exit commands
      if (trimmedLine === 'exit' || trimmedLine === 'quit') {
        this.output('Exiting interactive mode.', 'info');
        this.rl!.close();
        return;
      }
      
      // Add to history
      this.addToHistory(trimmedLine);
      
      // Parse command
      const [commandName, ...commandArgs] = trimmedLine.split(' ');
      const { args, options } = this.parseArgs(commandArgs);
      
      // Handle help command
      if (commandName === 'help') {
        if (commandArgs.length > 0 && this.getCommand(commandArgs[0])) {
          this.showCommandHelp(commandArgs[0]);
        } else {
          this.showHelp();
        }
        this.rl!.prompt();
        return;
      }
      
      // Run command
      try {
        await this.runCommand(commandName, args, options);
      } catch (error) {
        // Error is already logged in runCommand
      }
      
      this.rl!.prompt();
    });
    
    this.rl.on('close', () => {
      this.output('Goodbye!', 'info');
      this.saveHistory().catch(err => logger.warn('Failed to save command history:', err));
      process.exit(0);
    });
    
    // Enable autocomplete
    if (this.config.enableAutoCompletion) {
      // The Node.js readline module provides built-in completer functionality
    }
    
    // Start prompt
    this.rl.prompt();
  }
  
  /**
   * Auto-completer for interactive mode
   * @param line Current input line
   * @returns Completion matches
   */
  private autoCompleter(line: string): [string[], string] {
    const completions: string[] = [];
    const inputParts = line.trim().split(' ');
    
    // If first word, suggest commands and aliases
    if (inputParts.length === 1) {
      // Add all command names
      for (const command of this.commands.values()) {
        completions.push(command.meta.name);
      }
      
      // Add all aliases
      for (const alias of this.aliases.keys()) {
        completions.push(alias);
      }
      
      // Add special commands
      completions.push('help', 'exit', 'quit');
    } 
    // If second word is 'help', suggest commands for help
    else if (inputParts.length === 2 && inputParts[0] === 'help') {
      // Add all command names
      for (const command of this.commands.values()) {
        completions.push(command.meta.name);
      }
      
      // Add all aliases
      for (const alias of this.aliases.keys()) {
        completions.push(alias);
      }
    }
    // Handle command-specific completions
    else {
      const commandName = inputParts[0];
      const command = this.getCommand(commandName);
      
      if (command) {
        // Add command-specific completions if applicable
        // This would need to be implemented by each command
      }
    }
    
    // Filter completions that match the current input
    const hits = completions.filter((c) => c.startsWith(inputParts[inputParts.length - 1]));
    
    // If there's a single hit that exactly matches the input, return
    // an empty array to allow the user to keep typing
    if (hits.length === 1 && hits[0] === inputParts[inputParts.length - 1]) {
      return [[], line];
    }
    
    return [hits.length ? hits : completions, inputParts[inputParts.length - 1]];
  }
  
  /**
   * Show application banner
   */
  private showBanner(): void {
    const banner = `
 __  __      _        _____  _____ _______ 
|  \\/  |    | |      / ____|/ ____|__   __|
| \\  / | ___| |_ __ | |  __| |  __   | |   
| |\\/| |/ _ \\ __/ _\` | | |_ | | |_ |  | |   
| |  | |  __/ || (_| | |__| | |__| |  | |   
|_|  |_|\\___|\\__\\__,_|\\_____|\\_____|  |_|   
                                           
v${this.config.appVersion} - TypeScript Implementation
`;
    
    this.output(chalk.cyan(banner));
  }
  
  /**
   * Show help information
   */
  public showHelp(): void {
    this.output('\nAvailable commands:\n', 'info');
    
    // Group commands by category
    const categories = new Map<string, ICommand[]>();
    
    for (const command of this.commands.values()) {
      const category = command.meta.category || 'General';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(command);
    }
    
    // Sort categories alphabetically
    const sortedCategories = Array.from(categories.keys()).sort();
    
    // Display commands by category
    for (const category of sortedCategories) {
      this.output(`\n${chalk.bold(category)}:`, 'info');
      
      const commands = categories.get(category)!;
      // Sort commands alphabetically
      commands.sort((a, b) => a.meta.name.localeCompare(b.meta.name));
      
      for (const command of commands) {
        const { name, description, aliases } = command.meta;
        const aliasText = aliases && aliases.length > 0 ? ` (${aliases.join(', ')})` : '';
        this.output(`  ${chalk.green(name)}${chalk.gray(aliasText)} - ${description}`, 'info');
      }
    }
    
    this.output('\nUse `help <command>` for more information about a specific command.\n', 'info');
  }
  
  /**
   * Show help for a specific command
   * @param commandName Command name or alias
   */
  public showCommandHelp(commandName: string): void {
    const command = this.getCommand(commandName);
    
    if (!command) {
      this.output(`Unknown command: ${commandName}`, 'error');
      return;
    }
    
    this.output(command.getHelp());
  }
  
  /**
   * Get a command by name or alias
   * @param name Command name or alias
   * @returns Command or undefined if not found
   */
  private getCommand(name: string): ICommand | undefined {
    // Check if it's an alias
    if (this.aliases.has(name)) {
      name = this.aliases.get(name)!;
    }
    
    return this.commands.get(name);
  }
  
  /**
   * Parse command line arguments
   * @param args Command line arguments
   * @returns Parsed arguments and options
   */
  private parseArgs(args: string[]): { args: CommandArguments; options: CommandOptions } {
    const result: { args: CommandArguments; options: CommandOptions } = {
      args: {},
      options: {}
    };
    
    let i = 0;
    let positionalIndex = 0;
    
    while (i < args.length) {
      const arg = args[i];
      
      // Option with value (--key=value)
      if (arg.startsWith('--') && arg.includes('=')) {
        const [key, value] = arg.slice(2).split('=', 2);
        result.options[key] = this.parseValue(value);
      }
      // Long option (--key)
      else if (arg.startsWith('--')) {
        const key = arg.slice(2);
        
        // Check if next arg is a value (not a flag)
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          result.options[key] = this.parseValue(args[i + 1]);
          i++; // Skip the value
        } else {
          result.options[key] = true;
        }
      }
      // Short option (-k)
      else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        
        // Check if next arg is a value (not a flag)
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          result.options[key] = this.parseValue(args[i + 1]);
          i++; // Skip the value
        } else {
          result.options[key] = true;
        }
      }
      // Positional argument
      else {
        result.args[positionalIndex.toString()] = arg;
        positionalIndex++;
      }
      
      i++;
    }
    
    return result;
  }
  
  /**
   * Parse a string value to appropriate type
   * @param value String value
   * @returns Parsed value
   */
  private parseValue(value: string): any {
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Number
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return Number(value);
    }
    
    // Array (comma-separated values)
    if (value.includes(',')) {
      return value.split(',').map(v => this.parseValue(v.trim()));
    }
    
    // String
    return value;
  }
  
  /**
   * Convert arguments object to string
   * @param args Arguments object
   * @returns String representation
   */
  private argsToString(args: CommandArguments): string {
    return Object.values(args).join(' ');
  }
  
  /**
   * Convert options object to string
   * @param options Options object
   * @returns String representation
   */
  private optionsToString(options: CommandOptions): string {
    return Object.entries(options)
      .map(([key, value]) => {
        if (value === true) {
          return `--${key}`;
        } else {
          return `--${key}=${value}`;
        }
      })
      .join(' ');
  }
  
  /**
   * Output a message
   * @param text Message text
   * @param type Message type
   */
  private output(text: string, type: 'info' | 'error' | 'warn' | 'debug' | 'success' = 'info'): void {
    let coloredText: string;
    
    switch (type) {
      case 'error':
        coloredText = chalk.red(text);
        break;
      case 'warn':
        coloredText = chalk.yellow(text);
        break;
      case 'debug':
        coloredText = chalk.gray(text);
        break;
      case 'success':
        coloredText = chalk.green(text);
        break;
      case 'info':
      default:
        coloredText = text;
        break;
    }
    
    console.log(coloredText);
  }
  
  /**
   * Get user input
   * @param prompt Input prompt
   * @param options Input options
   * @returns Promise that resolves with user input
   */
  private async input(prompt: string, options: { password?: boolean } = {}): Promise<string> {
    if (!this.rl) {
      // Create temporary readline interface
      const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      return new Promise((resolve) => {
        tempRl.question(prompt, (answer) => {
          tempRl.close();
          resolve(answer);
        });
      });
    }
    
    // Use existing readline interface
    return new Promise((resolve) => {
      this.rl!.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }
  
  /**
   * Create a progress bar
   * @param total Total value
   * @returns Progress bar object
   */
  private createProgressBar(total: number): { update: (value: number) => void; complete: () => void } {
    let current = 0;
    const width = 40;
    
    // Initial display
    this.displayProgress(current, total, width);
    
    return {
      update: (value: number) => {
        current = value;
        this.displayProgress(current, total, width);
      },
      complete: () => {
        current = total;
        this.displayProgress(current, total, width);
        process.stdout.write('\n');
      }
    };
  }
  
  /**
   * Display progress bar
   * @param current Current value
   * @param total Total value
   * @param width Progress bar width
   */
  private displayProgress(current: number, total: number, width: number): void {
    const percent = Math.min(Math.floor((current / total) * 100), 100);
    const filled = Math.floor((width * current) / total);
    const empty = width - filled;
    
    const bar = `[${'='.repeat(filled)}${' '.repeat(empty)}] ${percent}% (${current}/${total})`;
    
    process.stdout.write(`\r${bar}`);
  }
  
  /**
   * Add a command to history
   * @param command Command string
   */
  private addToHistory(command: string): void {
    // Don't add duplicates consecutively
    if (this.history.length > 0 && this.history[0] === command) {
      return;
    }
    
    this.history.unshift(command);
    
    // Trim history if it exceeds maximum size
    if (this.history.length > this.config.maxHistoryEntries) {
      this.history = this.history.slice(0, this.config.maxHistoryEntries);
    }
  }
  
  /**
   * Load command history from file
   */
  private async loadHistory(): Promise<void> {
    try {
      const content = await fs.readFile(this.config.historyFile, 'utf-8');
      this.history = content.split('\n').filter(Boolean);
      logger.debug(`Loaded ${this.history.length} history entries`);
    } catch (error) {
      // File might not exist yet, which is fine
      logger.debug('Could not load command history (file might not exist yet)');
    }
  }
  
  /**
   * Save command history to file
   */
  private async saveHistory(): Promise<void> {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.config.historyFile);
      await fs.mkdir(dir, { recursive: true });
      
      // Save history
      await fs.writeFile(this.config.historyFile, this.history.join('\n'));
      logger.debug(`Saved ${this.history.length} history entries`);
    } catch (error) {
      logger.warn('Failed to save command history:', error);
    }
  }
  
  /**
   * Load user configuration from file
   */
  private async loadConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.config.configFile, 'utf-8');
      this.userConfig = JSON.parse(content);
      logger.debug('Loaded user configuration');
    } catch (error) {
      // File might not exist yet, which is fine
      logger.debug('Could not load user configuration (file might not exist yet)');
    }
  }
  
  /**
   * Save user configuration to file
   */
  public async saveConfig(): Promise<void> {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.config.configFile);
      await fs.mkdir(dir, { recursive: true });
      
      // Save config
      await fs.writeFile(this.config.configFile, JSON.stringify(this.userConfig, null, 2));
      logger.debug('Saved user configuration');
    } catch (error) {
      logger.warn('Failed to save user configuration:', error);
    }
  }
  
  /**
   * Get user configuration value
   * @param key Configuration key
   * @param defaultValue Default value if key doesn't exist
   * @returns Configuration value
   */
  public getConfig<T>(key: string, defaultValue?: T): T | undefined {
    return this.userConfig[key] ?? defaultValue;
  }
  
  /**
   * Set user configuration value
   * @param key Configuration key
   * @param value Configuration value
   */
  public setConfig(key: string, value: any): void {
    this.userConfig[key] = value;
  }
  
  /**
   * Get all user configuration
   * @returns User configuration object
   */
  public getAllConfig(): Record<string, any> {
    return { ...this.userConfig };
  }
} 