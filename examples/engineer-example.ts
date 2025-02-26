import { Engineer } from '../src/roles/engineer';
import { WriteCode } from '../src/actions/write-code';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { UserMessage } from '../src/types/message';
import { logger, LogLevel } from '../src/utils/logger';

// Set log level
logger.setLevel(LogLevel.DEBUG);

/**
 * Example of using the Engineer role with WriteCode action
 */
async function main() {
  try {
    console.log('Starting Engineer example...');
    
    // Create LLM provider
    const llmProvider = new VercelLLMProvider({
      providerType: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-3.5-turbo',
    });
    
    // Create WriteCode action
    const writeCodeAction = new WriteCode({
      name: 'WriteCode',
      description: 'Writes code based on requirements',
      llm: llmProvider,
    });
    
    // Create Engineer role with the WriteCode action
    const engineer = new Engineer(
      'CodeEngineer',
      'TypeScript Developer',
      'Write high-quality TypeScript code',
      'Follow best practices and coding standards',
      [writeCodeAction]
    );
    
    // Set react mode
    engineer.setReactMode('react', 1);
    
    // Create a user message with a coding task
    const userMessage = new UserMessage(
      'Please implement a simple TypeScript function that calculates the Fibonacci sequence up to n terms.'
    );
    
    console.log('Sending request to Engineer...');
    
    // Run the engineer role with the user message
    const response = await engineer.run(userMessage);
    
    // Display the response
    console.log('\n--- Engineer Response ---');
    console.log(response.content);
    console.log('------------------------\n');
    
  } catch (error) {
    console.error('Error in Engineer example:', error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
} 