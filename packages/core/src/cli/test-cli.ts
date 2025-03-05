/**
 * CLI Test Script
 * 
 * This file is intended to test the CLI functionality without needing to use the bin/metagpt.ts file.
 * It directly imports the CLI modules and runs commands for testing purposes.
 */

import { createCLI } from './index';

async function testCLI() {
  try {
    console.log('Starting CLI test...');
    
    // Create CLI instance
    const cli = createCLI();
    console.log('CLI instance created');
    
    // Test basic commands
    console.log('\n=== Testing help command ===');
    await cli.runCommand('help');
    
    console.log('\n=== Testing version command ===');
    await cli.runCommand('version');
    
    console.log('\n=== Testing config list command ===');
    await cli.runCommand('config', { '0': 'list' });
    
    console.log('\nCLI test completed successfully!');
  } catch (error) {
    console.error('CLI test failed:', error);
  }
}

// Run the test
testCLI(); 