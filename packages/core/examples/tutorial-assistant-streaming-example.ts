import { TutorialAssistant, RunMode } from '../src/roles/tutorial-assistant';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { logger, LogLevel } from '../src/utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';

// Set log level
logger.setLevel(LogLevel.INFO);

/**
 * Example of using the TutorialAssistant with unified run method
 * supporting both streaming and regular modes
 */
async function main() {
  try {
    logger.info('Starting TutorialAssistant example...');
    
    // Check for API key
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY;
    logger.info('✓ Checking environment variables');
    
    if (!apiKey) {
      logger.error('❌ Error: Please set environment variable: DASHSCOPE_API_KEY or OPENAI_API_KEY');
      process.exit(1);
    }
    logger.info('✓ Environment variables set');
    
    // Initialize LLM provider
    logger.info('⚙️ Configuring LLM provider...');
    
    // Choose provider based on available API key
    const providerType = process.env.DASHSCOPE_API_KEY ? 'qwen' : 'openai';
    const model = providerType === 'qwen' ? 'qwen-plus-2025-01-25' : 'gpt-3.5-turbo';
    const baseURL = providerType === 'qwen' 
      ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' 
      : undefined;
    
    const llmProvider = new VercelLLMProvider({
      providerType,
      apiKey,
      model,
      baseURL,
      extraConfig: {
        generateOptions: {
          system: '你是一位专业的教程编写专家，擅长生成高质量、结构清晰的教程文档。'
        }
      }
    });
    
    // Set system prompt
    llmProvider.setSystemPrompt('你是一位专业的教程编写专家，擅长生成高质量、结构清晰的教程文档。');
    logger.info(`✓ Model configured: ${llmProvider.getName()} - ${llmProvider.getModel()}`);
    
    // Create output directory
    const outputDir = path.join(process.cwd(), 'tutorials');
    await fs.mkdir(outputDir, { recursive: true });
    logger.info(`✓ Output directory created: ${outputDir}`);
    
    // Initialize TutorialAssistant
    const tutorialAssistant = new TutorialAssistant({
      llm: llmProvider,
      language: 'Chinese', // or 'English'
      outputDir
    });
    logger.info('✓ TutorialAssistant initialized');
    
    // Tutorial topic
    const topic = '如何使用TypeScript开发一个聊天机器人';
    logger.info(`Topic: "${topic}"`);
    
    // Create message
    const message = {
      id: '1',
      content: topic,
      role: 'user',
      causedBy: 'user',
      sentFrom: 'user',
      timestamp: new Date().toISOString(),
      sendTo: new Set(['*']),
      instructContent: null,
    };
    
    // Determine run mode from command line arguments
    const runMode = RunMode.STREAMING
    
    logger.info(`Running in ${runMode} mode (use --stream or -s flag to enable streaming)`);
    
    if (runMode === RunMode.STREAMING) {
      logger.info('Starting streaming tutorial generation...');
      logger.info('\n--- Streaming generation started ---\n');
      
      // Track current section
      let currentSection = '';
      
      // Use run method with streaming options
      const result = await tutorialAssistant.run(message, {
        mode: RunMode.STREAMING,
        streamCallback: (chunk, sectionTitle) => {
          // Update current section if changed
          if (currentSection !== sectionTitle) {
            if (currentSection !== '') {
              process.stdout.write('\n\n');
            }
            process.stdout.write(`\n--- Generating section: ${sectionTitle} ---\n\n`);
            currentSection = sectionTitle;
          }
          
          // Output chunk in real-time
          process.stdout.write(chunk);
        }
      });
      
      logger.info('\n\n--- Streaming generation completed ---');
      logger.info(`Result: ${result.content}`);
    } else {
      logger.info('Starting regular tutorial generation...');
      
      // Use run method with regular mode (default)
      const startTime = Date.now();
      const result = await tutorialAssistant.run(message);
      const endTime = Date.now();
      
      logger.info('--- Regular generation completed ---');
      logger.info(`Result: ${result.content}`);
      logger.info(`Generation took ${(endTime - startTime) / 1000} seconds`);
    }
    
  } catch (error) {
    logger.error('Error in TutorialAssistant example:', error);
    if (error instanceof Error) {
      logger.error(`Error type: ${error.name}`);
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    }
  }
}

// Run the example
if (require.main === module) {
  main().catch(error => logger.error('Unhandled error:', error));
} 