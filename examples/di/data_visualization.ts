/**
 * Data Visualization Example
 * 
 * This example demonstrates how to use the DataInterpreter class to perform
 * data analysis and visualization tasks in TypeScript.
 */

import { DataInterpreter, RunMode } from '../../src/roles/data-interpreter';
import { logger, LogLevel } from '../../src/utils/logger';
import type { LLMProvider } from '../../src/types/llm';
import type { Message } from '../../src/types/message';
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
 * Save conversation history
 * @param role The role instance
 */
async function saveHistory(role: DataInterpreter): Promise<void> {
  try {
    // Create output directory if it doesn't exist
    const outputDir = 'output';
    await fs.mkdir(outputDir, { recursive: true });
    
    // Get messages from memory
    const messages = await role.context.workingMemory?.get() || [];
    
    // Format messages
    const formattedMessages = messages.map((msg: Message) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }));
    
    // Save to file
    const historyPath = path.join(outputDir, `data_interpreter_history_${Date.now()}.json`);
    await fs.writeFile(
      historyPath,
      JSON.stringify(formattedMessages, null, 2)
    );
    
    logger.info(`History saved to ${historyPath}`);
  } catch (error) {
    logger.error(`Failed to save history: ${error}`);
  }
}

/**
 * Create a simple LLM provider that delegates to a real provider
 * @param realProvider The actual LLM provider to use
 * @returns A configured LLM provider
 */
function createLLMProvider(realProvider: LLMProvider | null = null): LLMProvider {
  if (realProvider) {
    return realProvider;
  }
  
  // Mock LLM provider for testing
  return {
    chat: async (message: string): Promise<string> => {
      logger.info(`[Mock LLM] Received chat request: ${message.substring(0, 100)}...`);
      return JSON.stringify({
        thoughts: "I'll analyze the sklearn Iris dataset and create visualizations",
        code: `
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.datasets import load_iris

# Load the Iris dataset
iris = load_iris()
df = pd.DataFrame(iris.data, columns=iris.feature_names)
df['species'] = [iris.target_names[i] for i in iris.target]

# Display basic information about the dataset
print("Iris Dataset Information:")
print(f"Number of samples: {df.shape[0]}")
print(f"Number of features: {len(iris.feature_names)}")
print(f"Features: {', '.join(iris.feature_names)}")
print(f"Target classes: {', '.join(iris.target_names)}")

# Display basic statistics
print("\\nBasic Statistics:")
print(df.describe())

# Create a pairplot to visualize relationships between features
print("\\nCreating pairplot visualization...")
plt.figure(figsize=(12, 8))
sns.pairplot(df, hue='species', markers=['o', 's', 'D'])
plt.savefig('iris_pairplot.png')
print("Saved pairplot to 'iris_pairplot.png'")

# Create a heatmap of correlation matrix
plt.figure(figsize=(10, 8))
correlation = df.drop('species', axis=1).corr()
sns.heatmap(correlation, annot=True, cmap='coolwarm')
plt.title('Feature Correlation Matrix')
plt.tight_layout()
plt.savefig('iris_correlation.png')
print("Saved correlation heatmap to 'iris_correlation.png'")

print("\\nAnalysis complete!")
`,
        insights: "The Iris dataset is well-suited for classification tasks and shows clear patterns in feature relationships",
        next_action: false
      });
    },
    generate: async (prompt: string): Promise<string> => {
      logger.info(`[Mock LLM] Received generate request: ${prompt.substring(0, 100)}...`);
      return JSON.stringify({
        thoughts: "I'll analyze the sklearn Iris dataset and create visualizations",
        code: `
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.datasets import load_iris

# Load the Iris dataset
iris = load_iris()
df = pd.DataFrame(iris.data, columns=iris.feature_names)
df['species'] = [iris.target_names[i] for i in iris.target]

# Display basic information about the dataset
print("Iris Dataset Information:")
print(f"Number of samples: {df.shape[0]}")
print(f"Number of features: {len(iris.feature_names)}")
print(f"Features: {', '.join(iris.feature_names)}")
print(f"Target classes: {', '.join(iris.target_names)}")

# Create a visualization
plt.figure(figsize=(12, 6))
sns.boxplot(x='species', y='sepal length (cm)', data=df)
plt.title('Sepal Length by Species')
plt.tight_layout()
plt.savefig('iris_boxplot.png')
print("Saved boxplot to 'iris_boxplot.png'")

print("\\nAnalysis complete!")
`,
        insights: "The Iris dataset shows distinct patterns across the three species",
        next_action: false
      });
    },
    getName: () => "Mock LLM Provider",
    getModel: () => "Mock Model"
  };
}

/**
 * Main function to run the data visualization example
 * @param requirement The analysis requirement
 */
async function main(requirement: string = ""): Promise<void> {
  logger.info("Starting Data Visualization Example");
  
  try {
    // If no requirement is provided, use a default one
    if (!requirement) {
      requirement = "Run data analysis on sklearn Iris dataset, include a plot";
    }
    
    logger.info(`Requirement: ${requirement}`);
    
    // Create LLM provider
    const llmProvider = createLLMProvider();
    
    // Create DataInterpreter instance
    const di = new DataInterpreter({
      llm: llmProvider,
      auto_run: true,
      use_plan: true,
      use_reflection: false,
      react_mode: 'plan_and_act',
      max_react_loop: 3,
      outputDir: './output',
      dependencyManagement: {
        enabled: true,
        autoInstall: true
      }
    });
    
    // Create message from requirement
    const message = createMessage(requirement);
    
    // Run the analysis
    logger.info("Running data analysis...");
    const response = await di.run(message);
    
    // Log the response
    logger.info("Analysis completed");
    logger.info(`Response: ${response.content.substring(0, 200)}...`);
    
    // Save conversation history
    await saveHistory(di);
    
    // Clean up resources
    await di.cleanup();
    
  } catch (error) {
    logger.error(`Error in main function: ${error}`);
  }
}

// Check if this file is being run directly
if (require.main === module) {
  const requirement = process.argv[2] || "Run data analysis on sklearn Iris dataset, include a plot";
  main(requirement)
    .then(() => logger.info("Example completed"))
    .catch(error => logger.error(`Failed to run example: ${error}`));
}

// Export for testing/importing
export { main, createMessage, saveHistory }; 