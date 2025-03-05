/**
 * 直接使用 Vercel AI SDK 调用百炼大模型(qwen-plus)的示例
 * 
 * 运行前需要:
 * 1. 安装依赖: bun add qwen-ai-provider ai
 * 2. 设置环境变量: DASHSCOPE_API_KEY
 */

// @ts-nocheck - 忽略类型检查，这是由于ai库和provider库之间的版本差异导致的类型不兼容
import { generateText } from 'ai';
import { createQwen } from 'qwen-ai-provider';

async function main() {
  try {
    // 检查环境变量
    const apiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!apiKey) {
      console.error('请设置环境变量: DASHSCOPE_API_KEY');
      process.exit(1);
    }
    
    // 设置环境变量
    process.env.DASHSCOPE_API_KEY = apiKey;
    
    // 创建自定义配置的qwen提供商
    const qwen = createQwen({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      debug: true, // 启用调试日志
      // 其他可能的配置选项
    });
    
    console.log('初始化完成，开始生成文本...');
    
    // 设置提示词
    const prompt = '写一个4人份的素食千层面食谱。';
    console.log(`提示词: "${prompt}"`);
    
    // 生成文本
    console.time('生成耗时');
    const { text } = await generateText({
      model: qwen('qwen-plus'),
      prompt,
      temperature: 0.7,
      maxTokens: 1000,
      system: '你是一位专业的素食厨师，擅长制作美味的素食料理。',
    });
    console.timeEnd('生成耗时');
    
    console.log('\n====== 生成结果 ======\n');
    console.log(text);
    console.log('\n====== 结束 ======\n');
    
  } catch (error) {
    console.error('生成文本时出错:', error);
  }
}

// 运行示例
main(); 