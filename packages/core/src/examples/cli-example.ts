/**
 * @module cli-example
 * @category Examples
 * @description Example demonstrating how to use the MetaGPT CLI
 */

import { createCLI } from '../cli';
import * as path from 'path';
import { logger } from '../utils/logger';

/**
 * Run CLI example
 */
async function runCLIExample() {
  logger.info('Starting CLI example...');
  
  // Create CLI manager
  const cli = createCLI();
  
  // Example 1: Show help
  logger.info('Example 1: Show help');
  await cli.runCommand('help');
  
  // Example 2: Show version
  logger.info('\nExample 2: Show version');
  await cli.runCommand('version');
  
  // Example 3: Run a command with arguments and options
  logger.info('\nExample 3: Run a command with arguments and options');
  logger.info('This example creates a sample project structure');
  
  const tmpDir = path.join(process.cwd(), 'tmp-cli-example');
  process.chdir(process.cwd());
  
  await cli.runCommand('init', {
    '0': 'sample-project'
  }, {
    'no-git': true,
    'no-jest': true,
    description: 'A sample MetaGPT project created from the CLI example'
  });
  
  // Example 4: Config management
  logger.info('\nExample 4: Config management');
  
  // Set a config value
  await cli.runCommand('config', {
    '0': 'set',
    '1': 'example.testValue',
    '2': 'Hello from CLI example!'
  });
  
  // Get the config value
  await cli.runCommand('config', {
    '0': 'get',
    '1': 'example.testValue'
  });
  
  // List all config values
  await cli.runCommand('config', {
    '0': 'list'
  });
  
  logger.info('\nCLI example completed successfully!');
}

// Run the example if this file is executed directly
if (require.main === module) {
  runCLIExample().catch(error => {
    logger.error('Error running CLI example:', error);
    process.exit(1);
  });
}

export { runCLIExample }; 