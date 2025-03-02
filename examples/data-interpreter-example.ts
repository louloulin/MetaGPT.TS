import { v4 as uuidv4 } from 'uuid';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { DataInterpreter, RunMode } from '../src/roles/data-interpreter';
import { logger, LogLevel } from '../src/utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';

// Set log level
logger.setLevel(LogLevel.INFO);

/**
 * Example of using the DataInterpreter with unified run method
 * supporting both streaming and regular modes
 */
async function main() {
  try {
    logger.info('Starting DataInterpreter example...');
    
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
        qwenOptions: {
          debug: true,
        },
        generateOptions: {
          system: '你是一位专业的数据科学家，擅长数据分析、可视化和机器学习。'
        }
      }
    });
    
    logger.info(`✓ Model configured: ${llmProvider.getName()} - ${llmProvider.getModel()}`);
    
    // Create output directory for analysis results
    const outputDir = path.join(process.cwd(), 'analysis_results');
    await fs.mkdir(outputDir, { recursive: true });
    logger.info(`✓ Output directory created: ${outputDir}`);
    
    // Initialize DataInterpreter
    logger.info('⚙️ Initializing data interpreter...');
    console.time('Data interpreter initialization time');
    
    const dataInterpreter = new DataInterpreter({
      llm: llmProvider,
      auto_run: true,
      use_plan: false,
      use_reflection: true,
      react_mode: 'react',
      max_react_loop: 2,
      tools: ['pandas', 'matplotlib', 'seaborn', 'scikit-learn'],
      outputDir
    });
    
    console.timeEnd('Data interpreter initialization time');
    logger.info('✓ Data interpreter initialized');
    
    // Analysis requirement
    const requirement = '使用Python分析鸢尾花数据集，包括基本统计信息、相关性分析和可视化，最后使用SVM算法进行分类。';
    logger.info(`📝 Analysis requirement: "${requirement}"`);
    
    // Check Python environment
    logger.info('🔍 Checking Python environment...');
    await checkPythonEnvironment();
    
    // Create message
    const message = {
      id: uuidv4(),
      content: requirement,
      role: 'user',
      causedBy: 'user',
      sentFrom: 'user',
      timestamp: new Date().toISOString(),
      sendTo: new Set(['*']),
      instructContent: null,
    };
    
    // Determine run mode
    const runMode = RunMode.STREAMING;
    logger.info(`Running in ${runMode} mode`);
    
    // Start analysis
    logger.info('🔄 Starting data analysis...');
    console.time('Data analysis total time');
    
    if (runMode === RunMode.STREAMING) {
      logger.info('Starting streaming analysis...');
      logger.info('\n--- Streaming analysis started ---\n');
      
      // Track current section
      let currentSection = '';
      
      // Use run method with streaming options
      const result = await dataInterpreter.run(message, {
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
      
      logger.info('\n\n--- Streaming analysis completed ---');
      logger.info(`Result: ${result.content}`);
    } else {
      logger.info('Starting regular analysis...');
      
      // Use run method with regular mode
      const startTime = Date.now();
      const result = await dataInterpreter.run(message);
      const endTime = Date.now();
      
      logger.info('--- Regular analysis completed ---');
      logger.info(`Result: ${result.content}`);
      logger.info(`Analysis took ${(endTime - startTime) / 1000} seconds`);
    }
    
    console.timeEnd('Data analysis total time');
    logger.info('✅ Data analysis completed!');
    
  } catch (error) {
    logger.error('Error in DataInterpreter example:', error);
    if (error instanceof Error) {
      logger.error(`Error type: ${error.name}`);
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

/**
 * Check Python environment
 */
async function checkPythonEnvironment(): Promise<void> {
  const { exec } = require('child_process');
  
  return new Promise((resolve, reject) => {
    // Check Python version
    exec('python --version', (error: any, stdout: string, stderr: string) => {
      if (error) {
        logger.error('❌ Python not detected! Please ensure Python is installed and added to PATH.');
        reject(new Error('Python not found'));
        return;
      }
      
      logger.info(`✓ Python detected: ${stdout.trim()}`);
      
      // Check common data science packages
      const packages = ['pandas', 'numpy', 'matplotlib', 'seaborn', 'scikit-learn'];
      let installedCount = 0;
      let missingPackages: string[] = [];
      
      const checkPackage = (index: number) => {
        if (index >= packages.length) {
          // All packages checked
          logger.info(`✓ Installed packages: ${installedCount}/${packages.length}`);
          
          if (missingPackages.length > 0) {
            const pipCmd = `pip install ${missingPackages.join(' ')}`;
            logger.warn(`⚠️ Missing Python packages: ${missingPackages.join(', ')}`);
            logger.info(`💡 Suggested command: ${pipCmd}`);
          }
          
          resolve();
          return;
        }
        
        const pkg = packages[index];
        exec(`python -c "import ${pkg}" 2>/dev/null`, (err: any) => {
          if (err) {
            logger.warn(`✗ Not installed: ${pkg}`);
            missingPackages.push(pkg);
          } else {
            logger.info(`✓ Installed: ${pkg}`);
            installedCount++;
          }
          
          // Check next package
          checkPackage(index + 1);
        });
      };
      
      // Start checking first package
      checkPackage(0);
    });
  });
}

// Run the example
if (require.main === module) {
  main().catch(error => logger.error('Unhandled error:', error));
} 