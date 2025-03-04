/**
 * @module Examples
 * @category Examples
 * @description Example demonstrating the CodeUnderstandingService
 */

import { CodeUnderstandingService } from '../src/services/code-understanding';
import { logger } from '../src/utils/logger';
import * as path from 'path';
import dotenv from 'dotenv';
import { createLLMProvider } from './llm-provider';

import * as fs from 'fs/promises';

// Load environment variables
dotenv.config();

/**
 * Code Understanding example
 * This demonstrates how to use the CodeUnderstandingService to analyze a codebase
 * and get insights for incremental development
 */
async function runCodeUnderstandingExample() {
  logger.info('Starting Code Understanding Example');
  
  try {
    // Create a output directory for results
    const resultsDir = path.join(process.cwd(), 'code-understanding-results');
    try {
      await fs.mkdir(resultsDir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
    
    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    
    // Initialize LLM provider if API key is available
    let llmProvider = null;
    if (apiKey) {
      llmProvider = createLLMProvider('你是一位专业的AI助手，擅长分析代码，并给出改进建议。');
      logger.info('LLM provider initialized with OpenAI');
    } else {
      logger.warn('No OpenAI API key found, running without LLM capabilities');
    }
    
    // Initialize the code understanding service
    // Point it to the metagpt-ts directory to analyze itself
    const service = new CodeUnderstandingService({
      baseDir: path.join(process.cwd(), '..'), // Go up one level from examples
      include: ['**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.test.ts', '**/*.spec.ts'],
      detailedAnalysis: !!llmProvider, // Enable detailed analysis if LLM is available
      llm: llmProvider,
      enableCache: true,
    });
    
    // Initialize the service (this scans and analyzes the codebase)
    logger.info('Initializing Code Understanding Service...');
    await service.initialize();
    
    // Example 1: Analyze a specific file
    const targetFile = '../services/code-understanding/code-understanding-service.ts';
    logger.info(`Analyzing file: ${targetFile}`);
    
    const fileAnalysis = await service.analyzeFile(targetFile);
    if (fileAnalysis) {
      await fs.writeFile(
        path.join(resultsDir, 'file-analysis.json'),
        JSON.stringify(fileAnalysis, null, 2)
      );
      logger.info(`File analysis saved to: ${path.join(resultsDir, 'file-analysis.json')}`);
    }
    
    // Example 2: Get suggestions for improvements
    if (llmProvider) {
      logger.info('Getting improvement suggestions...');
      const suggestions = await service.suggestImprovements(targetFile);
      
      await fs.writeFile(
        path.join(resultsDir, 'improvement-suggestions.txt'),
        suggestions.join('\n\n')
      );
      logger.info(`Improvement suggestions saved to: ${path.join(resultsDir, 'improvement-suggestions.txt')}`);
    }
    
    // Example 3: Analyze impact of changes
    logger.info('Analyzing impact of changes...');
    const impactAnalysis = await service.analyzeImpact(targetFile);
    
    await fs.writeFile(
      path.join(resultsDir, 'impact-analysis.json'),
      JSON.stringify(impactAnalysis, null, 2)
    );
    logger.info(`Impact analysis saved to: ${path.join(resultsDir, 'impact-analysis.json')}`);
    
    // Example 4: Get context for changes
    logger.info('Getting context for changes...');
    const changeContext = await service.getContextForChanges(targetFile);
    
    // Only save the non-file parts to avoid huge JSON files
    const contextToSave = {
      dependencies: changeContext.dependencies,
      dependents: changeContext.dependents,
      relatedFiles: changeContext.relatedFiles,
      codeContext: changeContext.codeContext,
    };
    
    await fs.writeFile(
      path.join(resultsDir, 'change-context.json'),
      JSON.stringify(contextToSave, null, 2)
    );
    logger.info(`Change context saved to: ${path.join(resultsDir, 'change-context.json')}`);
    
    logger.info('Code Understanding Example completed successfully!');
  } catch (error) {
    logger.error('Error in Code Understanding Example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runCodeUnderstandingExample();
}

export { runCodeUnderstandingExample }; 