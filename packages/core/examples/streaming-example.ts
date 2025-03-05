import { BaseRole } from '../src/roles/base-role';
import { BaseAction } from '../src/actions/base-action';
import { Message } from '../src/types/message';
import { logger } from '../src/utils/logger';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import type { ActionConfig } from '../src/types/action';
import type { LLMProvider } from '../src/types/llm';

/**
 * Example action that supports streaming
 */
class StreamingWriteAction extends BaseAction {
  constructor(config: ActionConfig) {
    super(config);
  }

  protected async prompt(): Promise<string> {
    const topic = this.getArg<string>('topic') || 'artificial intelligence';
    return `Write a detailed explanation about ${topic}. Include key concepts, applications, and future implications.`;
  }

  async run(): Promise<any> {
    return this.runStream();
  }
}

/**
 * Example role that uses streaming
 */
class StreamingWriter extends BaseRole {
  constructor(llm: LLMProvider) {
    super(
      'StreamingWriter',
      'A writer that generates text with streaming support',
      'Generate detailed explanations about topics',
      'Write clear and informative content'
    );

    // Add the streaming action
    this.addAction(new StreamingWriteAction({
      name: 'StreamingWrite',
      description: 'Writes text with streaming support',
      llm
    }));
  }
}

/**
 * Example usage of streaming role
 */
async function main() {
  try {
    // Initialize LLM provider
    const llm = new VercelLLMProvider({
      providerType: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-3.5-turbo',
      extraConfig: {
        retryOptions: {
          maxRetries: 3,
          minTimeout: 1000
        }
      }
    });

    // Create role instance
    const writer = new StreamingWriter(llm);

    // Create input message
    const message = {
      role: 'user',
      content: 'Explain quantum computing',
      id: Date.now().toString(),
      causedBy: 'user',
      sentFrom: 'user',
      sendTo: new Set(['*']),
      timestamp: new Date().toISOString(),
      instructContent: null
    };

    // Run with streaming
    logger.info('Starting streaming generation...');
    await writer.run(message, {
      streaming: true,
      streamCallback: (chunk, actionName) => {
        process.stdout.write(chunk); // Print chunks as they arrive
        logger.debug(`Received chunk from ${actionName}`);
      }
    });
    
    logger.info('\nStreaming completed');
  } catch (error) {
    logger.error('Error in streaming example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
} 