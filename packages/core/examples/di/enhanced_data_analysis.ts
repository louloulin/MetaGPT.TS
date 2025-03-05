/**
 * Enhanced Data Analysis Example
 * 
 * This example demonstrates how to use the EnhancedDataInterpreter class
 * for simplified data analysis and visualization in TypeScript.
 */

import { DataInterpreter, RunMode } from '../../src/roles/data-interpreter';
import { logger, LogLevel } from '../../src/utils/logger';
import type { LLMProvider } from '../../src/types/llm';
import type { Message } from '../../src/types/message';
import type { DependencyManagerConfig } from '../../src/actions/dependency-manager/dependency-manager';
import { ExecuteNbCode } from '../../src/actions/di/execute-nb-code';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

// Set log level
logger.setLevel(LogLevel.INFO);

/**
 * Create a message object
 * @param content Message content
 * @returns A message object
 */
function createMessage(content: string): Message {
  return {
    id: uuidv4(),
    content,
    role: 'user',
    causedBy: 'user',
    sentFrom: 'user',
    timestamp: new Date().toISOString(),
    sendTo: new Set(['*']),
    instructContent: null,
  };
}

/**
 * Enhanced DataInterpreter wrapper for simpler usage
 */
class EnhancedDataInterpreter extends DataInterpreter {
  private codeExecutor: ExecuteNbCode;
  
  constructor(config: any, llmProvider: LLMProvider) {
    super(config);
    
    // Initialize code executor
    this.codeExecutor = new ExecuteNbCode(llmProvider, {
      projectPrefix: config.codeExecution?.projectPrefix || '数据分析',
      preserveFiles: config.codeExecution?.preserveFiles !== false,
      baseDir: config.codeExecution?.baseDir || 'workspace',
      setupPipLink: config.codeExecution?.setupPipLink !== false,
      checkDependencies: config.codeExecution?.checkDependencies !== false,
      autoInstallDependencies: config.codeExecution?.autoInstallDependencies || false,
      skipDependenciesErrors: config.codeExecution?.skipDependenciesErrors || false,
      useVirtualEnv: config.codeExecution?.useVirtualEnv || false,
      preInstallCommonDeps: config.codeExecution?.preInstallCommonDeps || false
    });
    
    logger.info(`[EnhancedDataInterpreter] Initialized code executor, project prefix: ${config.codeExecution?.projectPrefix || '数据分析'}`);
    logger.info(`[EnhancedDataInterpreter] Workspace directory: ${config.codeExecution?.baseDir || 'workspace'}`);
    logger.info(`[EnhancedDataInterpreter] Setup pip symlink: ${config.codeExecution?.setupPipLink !== false ? 'Yes' : 'No'}`);
    logger.info(`[EnhancedDataInterpreter] Check dependencies: ${config.codeExecution?.checkDependencies !== false ? 'Yes' : 'No'}`);
    logger.info(`[EnhancedDataInterpreter] Auto install dependencies: ${config.codeExecution?.autoInstallDependencies ? 'Yes' : 'No'}`);
    logger.info(`[EnhancedDataInterpreter] Skip dependency errors: ${config.codeExecution?.skipDependenciesErrors ? 'Yes' : 'No'}`);
    logger.info(`[EnhancedDataInterpreter] Use virtual environment: ${config.codeExecution?.useVirtualEnv ? 'Yes' : 'No'}`);
    logger.info(`[EnhancedDataInterpreter] Pre-install common dependencies: ${config.codeExecution?.preInstallCommonDeps ? 'Yes' : 'No'}`);
  }
  
  /**
   * Regular analysis method
   * @param requirement Analysis requirement
   */
  async analyze(requirement: string): Promise<string> {
    const message = createMessage(requirement);
    const result = await this.run(message);
    return result.content;
  }

  /**
   * Streaming analysis method
   * @param requirement Analysis requirement
   * @param callback Streaming callback function
   */
  async streamAnalyze(requirement: string, callback: (chunk: string, section: string) => void): Promise<string> {
    const message = createMessage(requirement);
    const result = await this.run(message, {
      mode: RunMode.STREAMING,
      streamCallback: callback
    });
    return result.content;
  }
  
  /**
   * Directly execute code
   * @param code Code to execute
   * @returns [result, success]
   */
  async executeCode(code: string): Promise<[string, boolean]> {
    return await this.codeExecutor.run(code);
  }
  
  /**
   * Get current workspace directory
   */
  getCurrentWorkspace(): string {
    return this.codeExecutor.getCurrentWorkspace();
  }
}

/**
 * Create a simple LLM provider
 * @returns A configured LLM provider
 */
function createLLMProvider(): LLMProvider {
  // Mock LLM provider for testing
  return {
    chat: async (message: string): Promise<string> => "LLM chat mock response",
    generate: async (prompt: string): Promise<string> => JSON.stringify({
      thoughts: "I'll analyze the dataset and create visualizations",
      code: `
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.datasets import load_diabetes

# Load the diabetes dataset
diabetes = load_diabetes()
df = pd.DataFrame(diabetes.data, columns=diabetes.feature_names)
df['target'] = diabetes.target

# Display basic information
print("Diabetes Dataset Information:")
print(f"Number of samples: {df.shape[0]}")
print(f"Number of features: {len(diabetes.feature_names)}")
print(f"Features: {', '.join(diabetes.feature_names)}")

# Display descriptive statistics
print("\nBasic Statistics:")
print(df.describe())

# Create a histogram of the target variable
plt.figure(figsize=(10, 6))
plt.hist(df['target'], bins=30, alpha=0.7, color='blue')
plt.title('Distribution of Diabetes Progression')
plt.xlabel('Disease Progression')
plt.ylabel('Frequency')
plt.grid(axis='y', alpha=0.3)
plt.savefig('diabetes_target_distribution.png')
print("Saved histogram to 'diabetes_target_distribution.png'")

# Create a correlation heatmap
plt.figure(figsize=(12, 10))
corr = df.corr()
sns.heatmap(corr, annot=True, cmap='coolwarm', fmt='.2f')
plt.title('Feature Correlation Matrix')
plt.tight_layout()
plt.savefig('diabetes_correlation.png')
print("Saved correlation heatmap to 'diabetes_correlation.png'")

# Create a pairplot for selected features
selected_features = ['bmi', 'bp', 's5', 'target']
plt.figure(figsize=(14, 10))
sns.pairplot(df[selected_features])
plt.savefig('diabetes_pairplot.png')
print("Saved pairplot to 'diabetes_pairplot.png'")

print("\nAnalysis complete!")
`,
      insights: "The diabetes dataset shows interesting correlations between BMI, blood pressure, and disease progression",
      next_action: false
    }),
    getName: () => "Mock LLM Provider",
    getModel: () => "Mock Model"
  };
}

/**
 * Save analysis results to file
 * @param content Analysis content
 * @param workspace Workspace directory
 */
async function saveResults(content: string, workspace: string): Promise<void> {
  try {
    // Create a results directory if it doesn't exist
    const resultsDir = path.join(workspace, 'results');
    await fs.mkdir(resultsDir, { recursive: true });
    
    // Save the analysis results
    const resultsPath = path.join(resultsDir, `analysis_result_${Date.now()}.md`);
    await fs.writeFile(resultsPath, content);
    
    logger.info(`Analysis results saved to ${resultsPath}`);
  } catch (error) {
    logger.error(`Failed to save results: ${error}`);
  }
}

/**
 * Main function to run the enhanced data analysis example
 * @param requirement The analysis requirement
 */
async function main(requirement: string = ""): Promise<void> {
  logger.info("Starting Enhanced Data Analysis Example");
  
  try {
    // If no requirement is provided, use a default one
    if (!requirement) {
      requirement = "Analyze the scikit-learn diabetes dataset and visualize key relationships";
    }
    
    logger.info(`Requirement: ${requirement}`);
    
    // Create LLM provider
    const llmProvider = createLLMProvider();
    
    // Configure the interpreter
    const config = {
      llm: llmProvider,
      auto_run: true,
      use_plan: true,
      use_reflection: false,
      react_mode: 'plan_and_act',
      max_react_loop: 3,
      outputDir: './output',
      dependencyManagement: {
        enabled: true,
        autoInstall: true,
        config: {
          workDir: './output',
          userInstall: true
        } as DependencyManagerConfig
      },
      codeExecution: {
        projectPrefix: '数据分析',
        preserveFiles: true,
        baseDir: 'workspace',
        setupPipLink: true,
        checkDependencies: true,
        autoInstallDependencies: true,
        skipDependenciesErrors: true,
        useVirtualEnv: true,
        preInstallCommonDeps: true
      }
    };
    
    // Create enhanced interpreter instance
    const interpreter = new EnhancedDataInterpreter(config, llmProvider);
    
    // Test direct code execution
    logger.info("Testing direct code execution...");
    const testCode = `
import matplotlib.pyplot as plt
import numpy as np

# Create sample data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Create a simple plot
plt.figure(figsize=(10, 6))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Sine Wave')
plt.xlabel('x')
plt.ylabel('sin(x)')
plt.grid(True)
plt.savefig('sine_wave.png')
print("Sine wave plot created and saved as 'sine_wave.png'")
`;

    const [testResult, testSuccess] = await interpreter.executeCode(testCode);
    if (testSuccess) {
      logger.info(`Code execution successful: ${testResult}`);
      const workspacePath = interpreter.getCurrentWorkspace();
      logger.info(`Workspace path: ${workspacePath}`);
    } else {
      logger.error(`Code execution failed: ${testResult}`);
    }
    
    // Now run the analysis based on the requirement
    logger.info("Running data analysis...");
    let analysisResult: string;
    
    if (config.react_mode === 'streaming') {
      // Use streaming mode
      let result = '';
      analysisResult = await interpreter.streamAnalyze(
        requirement,
        (chunk: string, section: string) => {
          logger.info(`[${section}] ${chunk.substring(0, 100)}...`);
          result += chunk;
        }
      );
    } else {
      // Use regular mode
      analysisResult = await interpreter.analyze(requirement);
    }
    
    logger.info("Analysis completed");
    logger.info(`Result: ${analysisResult.substring(0, 200)}...`);
    
    // Save results to workspace
    const workspace = interpreter.getCurrentWorkspace();
    if (workspace) {
      await saveResults(analysisResult, workspace);
    }
    
    // Clean up resources
    await interpreter.cleanup();
    
  } catch (error) {
    logger.error(`Error in main function: ${error}`);
  }
}

// Check if this file is being run directly
if (require.main === module) {
  const requirement = process.argv[2] || "Analyze the scikit-learn diabetes dataset and visualize key relationships";
  main(requirement)
    .then(() => logger.info("Example completed"))
    .catch(error => logger.error(`Failed to run example: ${error}`));
}

// Export for testing/importing
export { main, EnhancedDataInterpreter, saveResults }; 