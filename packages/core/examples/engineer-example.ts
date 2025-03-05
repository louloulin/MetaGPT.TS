import { Engineer } from '../src/roles/engineer';
import { WriteCode } from '../src/actions/write-code';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { UserMessage } from '../src/types/message';
import { logger, LogLevel } from '../src/utils/logger';
import { createLLMProvider } from './llm-provider';

// Set log level
logger.setLevel(LogLevel.DEBUG);

/**
 * Example of using the Engineer role with WriteCode action
 */
async function main() {
  try {
    console.log('Starting Engineer example...');
    
    // 创建 LLM Provider
    const provider = createLLMProvider(
      '你是一个IT工程师，编程大师，擅长编写高质量代码'
    );
    
    // Create WriteCode action with LLM
    const writeCodeAction = new WriteCode({
      name: 'WriteCode',
      description: 'Writes code based on requirements',
      llm: provider,
      args: {
        requirements: 'Please implement a simple TypeScript function that calculates the Fibonacci sequence up to n terms.',
        language: 'typescript'
      }
    });
    
    // 修改：创建Engineer角色，并使用初始化好的LLM
    const engineer = new Engineer(
      'CodeEngineer',
      provider,
      'TypeScript Developer',
      'Write high-quality TypeScript code',
      'Follow best practices and coding standards',
      [writeCodeAction]
    );
    
    // 设置反应模式
    engineer.setReactMode('react', 1);
    
    // 用户消息
    const userMessage = new UserMessage(
      'Please implement a simple TypeScript function that calculates the Fibonacci sequence up to n terms.'
    );
    
    console.log('Sending request to Engineer...');
    
    // 运行Engineer角色处理用户请求
    const response = await engineer.run(userMessage);
    
    // 显示响应结果
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