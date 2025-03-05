import { VercelLLMProvider } from '../src/provider/vercel-llm';

/**
 * 百炼大模型(qwen-plus)使用示例
 * 
 * 运行前需要:
 * 1. 安装依赖: bun add qwen-ai-provider
 * 2. 设置环境变量: DASHSCOPE_API_KEY
 */
async function main() {
  try {
    // 从环境变量获取API密钥
    const apiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!apiKey) {
      console.error('请设置环境变量: DASHSCOPE_API_KEY');
      process.exit(1);
    }
    
    // 初始化 Qwen 提供商
    const qwenProvider = new VercelLLMProvider({
      providerType: 'qwen',
      apiKey,
      model: 'qwen-plus',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', // 自定义API端点
      extraConfig: {
        qwenOptions: {
          // 可以在这里添加其他Qwen特定的配置选项
          debug: true, // 启用调试日志
        },
        // 生成选项，会传递给generateText方法
        generateOptions: {
          system: '你是一位专业的素食厨师，擅长制作美味的素食料理。',
        }
      }
    });
    
    console.log('初始化完成，开始生成文本...');
    
    // 设置提示词
    const prompt = '写一个4人份的素食千层面食谱。';
    console.log(`提示词: "${prompt}"`);
    
    // 生成文本
    console.time('生成耗时');
    const result = await qwenProvider.generate(prompt, {
      temperature: 0.7,
      maxTokens: 1000
    });
    console.timeEnd('生成耗时');
    
    console.log('\n====== 生成结果 ======\n');
    console.log(result);
    console.log('\n====== 结束 ======\n');
    
  } catch (error) {
    console.error('生成文本时出错:', error);
  }
}

// 运行示例
main(); 