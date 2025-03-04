#!/usr/bin/env node
/**
 * MetaGPT CLI entry point
 * 
 * This file serves as the main executable for the MetaGPT command line interface.
 * When installed globally, this script is what gets executed when running the 'metagpt' command.
 */

import { startCLI } from '../cli/index.js';

// Start the CLI with proper error handling
startCLI().catch((error) => {
  console.error('Failed to start CLI:', error);
  process.exit(1);
}); 