/**
 * @module CLI
 * @category CLI
 * @description Command Line Interface for MetaGPT
 */

import { CLIManager } from './cli-manager';
import { InitCommand } from './commands/init-command';
import { ConfigCommand } from './commands/config-command';
import { RunCommand } from './commands/run-command';
import { Command } from './command';
import type { CommandArguments, CommandOptions, CommandContext, CommandMeta } from './command';

// Export all CLI components
export {
  CLIManager,
  Command,
  InitCommand,
  ConfigCommand,
  RunCommand,
};

// Export types
export type {
  CommandArguments,
  CommandOptions,
  CommandContext,
  CommandMeta,
};

/**
 * Simple help command
 */
class HelpCommand extends Command {
  private manager: CLIManager;

  constructor(manager: CLIManager) {
    const meta: CommandMeta = {
      name: 'help',
      description: 'Show help information',
      aliases: ['h'],
      examples: [
        'metagpt help',
        'metagpt help init',
      ],
      category: 'General',
    };
    
    super(meta);
    this.manager = manager;
  }

  public async execute(
    args: CommandArguments,
    options: CommandOptions,
    context: CommandContext
  ): Promise<void> {
    const commandName = args['0'] as string;
    
    if (commandName) {
      this.manager.showCommandHelp(commandName);
    } else {
      this.manager.showHelp();
    }
  }
}

/**
 * Version command
 */
class VersionCommand extends Command {
  constructor() {
    const meta: CommandMeta = {
      name: 'version',
      description: 'Show version information',
      aliases: ['v'],
      examples: [
        'metagpt version',
      ],
      category: 'General',
    };
    
    super(meta);
  }

  public async execute(
    args: CommandArguments,
    options: CommandOptions,
    context: CommandContext
  ): Promise<void> {
    try {
      // Try to get version from package.json
      const packageJson = require('../../package.json');
      context.output(`MetaGPT-TS v${packageJson.version}`, 'info');
    } catch (error) {
      context.output('MetaGPT-TS v0.1.0', 'info');
    }
  }
}

/**
 * Create and initialize CLI manager
 * @returns CLI manager instance
 */
export function createCLI(): CLIManager {
  // Create CLI manager
  const manager = new CLIManager();
  
  // Register commands
  manager.registerCommands([
    new HelpCommand(manager),
    new VersionCommand(),
    new InitCommand(),
    new ConfigCommand(manager),
    new RunCommand(),
  ]);
  
  return manager;
}

/**
 * Start CLI
 * @param args Command line arguments
 * @returns Promise that resolves when CLI completes
 */
export async function startCLI(args: string[] = process.argv.slice(2)): Promise<void> {
  const manager = createCLI();
  await manager.start(args);
}

/**
 * Entry point for CLI
 */
if (require.main === module) {
  startCLI().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
} 