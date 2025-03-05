/**
 * Vercel AI SDK 增强版集成示例
 * 
 * 本示例演示如何使用增强版的 Vercel AI 集成，包括:
 * 1. 多种LLM提供商支持
 * 2. 流式输出优化
 * 3. 错误重试机制
 * 4. 不同类型的生成任务
 * 
 * 使用方法:
 * 1. 创建 .env 文件，添加需要的API密钥
 * 2. 运行: bun run examples/vercel-llm-enhanced-example.ts
 */

// @ts-ignore - dotenv 类型声明可能缺失，但不影响功能
import * as dotenv from 'dotenv';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import type { RetryMiddlewareOptions } from '../src/provider/vercel-retry-middleware';
import chalk from 'chalk';

// 加载环境变量
dotenv.config();

// 定义示例中使用的提示词
const EXAMPLE_PROMPTS = {
  short: "用一句话解释什么是量子纠缠。",
  medium: "写一个关于宇宙探索的短篇故事，约300字。",
  long: "请分析人工智能发展历史中的关键里程碑，并讨论可能的未来发展方向，包括伦理挑战和机遇。",
  technical: "解释神经网络中的反向传播算法原理及数学推导。",
  creative: "创作一首关于春天的诗，字数不限，风格自由。",
};

/**
 * 打印分隔线
 */
function printDivider() {
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * 打印标题
 * @param title 标题文本
 */
function printTitle(title: string) {
  console.log(chalk.bgBlue.white.bold(' ' + title + ' ') + '\n');
}

/**
 * 打印子标题
 * @param subtitle 子标题文本
 */
function printSubtitle(subtitle: string) {
  console.log(chalk.cyan.bold(subtitle) + '\n');
}

/**
 * 打印信息
 * @param label 标签
 * @param value 值
 */
function printInfo(label: string, value: string) {
  console.log(chalk.green(label + ': ') + value);
}

/**
 * 打印错误
 * @param message 错误信息
 */
function printError(message: string) {
  console.error(chalk.red.bold('错误: ') + message);
}

/**
 * 测试特定提供商的文本生成
 * @param provider 提供商实例
 * @param prompt 提示词
 */
async function testGenerate(provider: VercelLLMProvider, prompt: string) {
  printSubtitle(`测试文本生成 - ${provider.getName()} (${provider.getModel()})`);
  printInfo('提示词', prompt);
  console.log(chalk.yellow('生成中...\n'));
  
  try {
    const startTime = Date.now();
    const response = await provider.generate(prompt);
    const endTime = Date.now();
    
    console.log(chalk.green('响应:'));
    console.log(response);
    console.log(chalk.gray(`\n生成耗时: ${endTime - startTime}ms`));
  } catch (error) {
    printError((error as Error).message);
  }
}

/**
 * 测试流式文本生成
 * @param provider 提供商实例
 * @param prompt 提示词
 */
async function testStreamGenerate(provider: VercelLLMProvider, prompt: string) {
  printSubtitle(`测试流式生成 - ${provider.getName()} (${provider.getModel()})`);
  printInfo('提示词', prompt);
  console.log(chalk.yellow('生成中...\n'));
  
  try {
    const startTime = Date.now();
    let fullResponse = '';
    
    // 流式生成并实时输出
    process.stdout.write(chalk.green('响应: '));
    for await (const chunk of provider.generateStream(prompt)) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }
    
    const endTime = Date.now();
    console.log(chalk.gray(`\n\n生成耗时: ${endTime - startTime}ms`));
  } catch (error) {
    printError((error as Error).message);
  }
}

/**
 * 测试提供商的嵌入功能
 * @param provider 提供商实例
 * @param text 要嵌入的文本
 */
async function testEmbedding(provider: VercelLLMProvider, text: string) {
  printSubtitle(`测试文本嵌入 - ${provider.getName()}`);
  printInfo('输入文本', text);
  console.log(chalk.yellow('生成嵌入向量中...\n'));
  
  try {
    const startTime = Date.now();
    const embedding = await provider.embed(text);
    const endTime = Date.now();
    
    console.log(chalk.green('嵌入向量:'));
    console.log(`维度: ${embedding.length}`);
    console.log(`前5个值: [${embedding.slice(0, 5).join(', ')}]`);
    console.log(chalk.gray(`\n嵌入生成耗时: ${endTime - startTime}ms`));
  } catch (error) {
    printError((error as Error).message);
  }
}

/**
 * 测试错误重试功能
 * @param provider 提供商实例
 * @param prompt 提示词
 */
async function testErrorRetry(provider: VercelLLMProvider, prompt: string) {
  printSubtitle(`测试错误重试机制 - ${provider.getName()}`);
  printInfo('提示词', prompt);
  console.log(chalk.yellow('注意: 此测试会故意触发错误以验证重试机制\n'));
  
  try {
    // 自定义重试选项
    const customRetryOptions: RetryMiddlewareOptions = {
      maxRetries: 2,
      baseDelay: 100,
      onRetry: (error: Error, attempt: number) => {
        console.log(chalk.yellow(`尝试重试 #${attempt}: ${error.message}`));
      }
    };
    
    // 故意使用无效的API密钥触发错误
    const badKeyProvider = new VercelLLMProvider({
      providerType: provider.getName() as any,
      apiKey: 'invalid-api-key-to-test-retry',
      model: provider.getModel(),
      retryOptions: customRetryOptions,
    });
    
    await badKeyProvider.generate(prompt);
  } catch (error) {
    console.log(chalk.red('最终错误:'), (error as Error).message);
    console.log(chalk.green('\n重试机制按预期工作'));
  }
}

/**
 * 主函数
 */
async function main() {
  printTitle('Vercel AI 增强集成示例');
  
  // 创建不同的提供商实例
  const providers: Record<string, VercelLLMProvider> = {};
  
  // 根据环境变量判断可用的提供商
  if (process.env.OPENAI_API_KEY) {
    providers.openai = new VercelLLMProvider({
      providerType: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      retryOptions: {
        maxRetries: 2,
        baseDelay: 500,
        maxDelay: 5000,
      }
    });
  }
  
  if (process.env.DASHSCOPE_API_KEY) {
    providers.qwen = new VercelLLMProvider({
      providerType: 'qwen',
      apiKey: process.env.DASHSCOPE_API_KEY,
      model: 'qwen-plus',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      retryOptions: {
        maxRetries: 2,
        baseDelay: 500,
      }
    });
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    providers.anthropic = new VercelLLMProvider({
      providerType: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-sonnet-20240229',
      retryOptions: {
        maxRetries: 2,
        baseDelay: 500,
      }
    });
  }
  
  // 检查可用的提供商
  const availableProviders = Object.keys(providers);
  if (availableProviders.length === 0) {
    printError('没有找到可用的AI提供商。请在.env文件中添加至少一个API密钥。');
    console.log('支持的提供商:');
    console.log('- OpenAI: OPENAI_API_KEY');
    console.log('- Qwen: DASHSCOPE_API_KEY');
    console.log('- Anthropic: ANTHROPIC_API_KEY');
    return;
  }
  
  printInfo('可用的提供商', availableProviders.join(', '));
  
  // 使用第一个可用的提供商进行示例测试
  const defaultProvider = providers[availableProviders[0]];
  
  // 测试不同类型的生成
  printDivider();
  await testGenerate(defaultProvider, EXAMPLE_PROMPTS.short);
  
  printDivider();
  await testStreamGenerate(defaultProvider, EXAMPLE_PROMPTS.medium);
  
  // 如果可用，测试嵌入功能
  if (providers.openai) {
    printDivider();
    await testEmbedding(providers.openai, EXAMPLE_PROMPTS.short);
  }
  
  // 测试错误重试机制
  printDivider();
  await testErrorRetry(defaultProvider, EXAMPLE_PROMPTS.short);
  
  printDivider();
  printTitle('测试完成');
}

// 运行主函数
main().catch(error => {
  printError('程序执行出错:');
  console.error(error);
}); 