/**
 * @module CodeExecutionExample
 * @category Examples
 * @description Example usage of the Code Execution Environment
 */

import { CodeExecutionService } from '../environment/code-execution';
import { Sandbox } from '../environment/sandbox';
import { LLMFactory } from '../provider/llm-factory';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Run the code execution environment example
 */
export async function runCodeExecutionExample(): Promise<void> {
  logger.info('Starting Code Execution Environment Example');

  // Create a directory for results
  const resultsDir = path.join(process.cwd(), 'results', 'code-execution');
  try {
    await fs.mkdir(resultsDir, { recursive: true });
  } catch (error) {
    logger.error('Failed to create results directory:', error);
  }

  // Initialize the code execution service
  const codeExecutionService = new CodeExecutionService({
    workspaceDir: path.join(resultsDir, 'workspace'),
    autoAnalyze: true,
    autoSuggestFixes: true
  });

  // Optional: Add an LLM provider for enhanced code analysis
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const llm = LLMFactory.create({
        type: 'openai',
        apiKey,
        model: 'gpt-4-turbo'
      });
      codeExecutionService.setLLMProvider(llm);
      logger.info('LLM provider configured for code analysis');
    }
  } catch (error) {
    logger.warn('Could not configure LLM provider:', error);
  }

  // Example 1: Basic Code Execution (JavaScript)
  logger.info('Example 1: Basic JavaScript Execution');
  const jsCode = `
    function fibonacci(n) {
      if (n <= 1) return n;
      return fibonacci(n-1) + fibonacci(n-2);
    }
    
    console.log('Calculating Fibonacci numbers:');
    for (let i = 0; i < 10; i++) {
      console.log(\`Fibonacci(\${i}) = \${fibonacci(i)}\`);
    }
  `;

  const jsResult = await codeExecutionService.execute(jsCode, 'javascript');
  logger.info(`JavaScript execution result:
    Exit code: ${jsResult.exitCode}
    Execution time: ${jsResult.executionTimeMs}ms
    Memory usage: ${jsResult.memoryUsageMB}MB
    
    Output:
    ${jsResult.stdout}
  `);

  // Example 2: Code Execution with Error (Python)
  logger.info('Example 2: Python Execution with Error');
  const pythonCodeWithError = `
    def calculate_average(numbers):
        return sum(numbers) / len(numbers)
    
    # This will cause an error - division by zero
    print(calculate_average([]))
  `;

  const pythonResult = await codeExecutionService.execute(pythonCodeWithError, 'python');
  logger.info(`Python execution result:
    Exit code: ${pythonResult.exitCode}
    
    Error output:
    ${pythonResult.stderr}
    
    Analysis:
    ${pythonResult.analysis ? 
      `Quality Score: ${pythonResult.analysis.qualityScore}\n` +
      `Issues: ${pythonResult.analysis.issues.length}\n` +
      `Suggestions: ${pythonResult.analysis.suggestions.join('\n')}`
      : 'No analysis available'}
  `);

  // Example 3: Performance Testing
  logger.info('Example 3: Performance Testing');
  const performanceCode = `
    function calculatePrimes(max) {
      const sieve = new Array(max).fill(true);
      sieve[0] = false;
      sieve[1] = false;
      
      for (let i = 2; i <= Math.sqrt(max); i++) {
        if (sieve[i]) {
          for (let j = i * i; j < max; j += i) {
            sieve[j] = false;
          }
        }
      }
      
      const primes = [];
      for (let i = 2; i < max; i++) {
        if (sieve[i]) primes.push(i);
      }
      
      return primes;
    }
    
    const primes = calculatePrimes(10000);
    console.log(\`Found \${primes.length} prime numbers\`);
  `;

  const perfResults = await codeExecutionService.runPerformanceTest(
    performanceCode, 
    'javascript',
    3
  );
  
  logger.info(`Performance test results:
    Average execution time: ${perfResults.averageTimeMs.toFixed(2)}ms
    Min time: ${perfResults.minTimeMs.toFixed(2)}ms
    Max time: ${perfResults.maxTimeMs.toFixed(2)}ms
  `);

  // Example 4: Interactive REPL Session
  logger.info('Example 4: REPL Session');
  const repl = codeExecutionService.createREPL('javascript');
  
  // Execute a series of commands in the REPL
  const replCommands = [
    'let counter = 0;',
    'counter += 10;',
    'const greeting = "Hello, REPL!";',
    'console.log(`${greeting} Counter: ${counter}`);',
    'counter * 5'
  ];
  
  for (const command of replCommands) {
    logger.info(`REPL > ${command}`);
    const result = await repl.evaluate(command);
    logger.info(`Result: ${result.stdout || 'No output'}`);
  }
  
  // Clean up the REPL session
  await repl.terminate();

  // Example 5: Code with External Files
  logger.info('Example 5: Code with External Files');
  
  // Save some utility functions to a file
  const utilsCode = `
    export function add(a, b) {
      return a + b;
    }
    
    export function multiply(a, b) {
      return a * b;
    }
  `;
  
  const mainCode = `
    import { add, multiply } from './utils.js';
    
    console.log('Testing utility functions:');
    console.log('5 + 3 =', add(5, 3));
    console.log('4 * 7 =', multiply(4, 7));
  `;
  
  const multiFileResult = await codeExecutionService.execute(
    mainCode,
    'javascript',
    {
      files: [
        { path: 'utils.js', content: utilsCode }
      ]
    }
  );
  
  logger.info(`Multi-file execution result:
    Exit code: ${multiFileResult.exitCode}
    
    Output:
    ${multiFileResult.stdout}
  `);

  // Example 6: Using Docker (if available)
  logger.info('Example 6: Docker Execution (if available)');
  
  const dockerCode = `
    import os
    
    print("Current environment variables:")
    for key, value in os.environ.items():
        if not key.startswith("AWS") and not key.startswith("GOOGLE"):
            print(f"{key}={value}")
  `;
  
  try {
    const dockerResult = await codeExecutionService.execute(
      dockerCode,
      'python',
      {
        useDocker: true,
        env: { 'EXAMPLE_VAR': 'test-value' }
      }
    );
    
    if (dockerResult.error && dockerResult.error.includes('Docker')) {
      logger.info('Docker not available or not configured. Skipping example.');
    } else {
      logger.info(`Docker execution result:
        Exit code: ${dockerResult.exitCode}
        
        Output:
        ${dockerResult.stdout}
      `);
    }
  } catch (error) {
    logger.info('Docker execution not available:', error);
  }

  logger.info('Code Execution Environment Example completed');
}

// Run the example if this file is executed directly
if (require.main === module) {
  runCodeExecutionExample().catch(error => {
    logger.error('Error running code execution example:', error);
    process.exit(1);
  });
} 