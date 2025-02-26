# 流式响应 (Streaming) 功能

MetaGPT-TS 支持使用 Vercel AI SDK 的流式响应功能，可以实时获取 LLM 生成的内容，而不必等待整个响应完成。这对于提升用户体验和实现实时交互非常有用。

## 基本概念

流式响应 (Streaming) 是一种将 LLM 生成的内容分块传输的技术，可以让用户在生成过程中就看到部分结果，而不必等待整个响应完成。这对于长文本生成特别有用，可以显著提升用户体验。

## 使用方法

### 1. 使用 VercelLLMProvider 的流式方法

`VercelLLMProvider` 提供了两个流式方法：

- `generateStream`: 用于生成文本流
- `chatStream`: 用于聊天流式响应

这两个方法都返回 `AsyncGenerator<string>`，可以使用 `for await...of` 循环来获取每个文本块。

```typescript
// 初始化 LLM 提供商
const llmProvider = new VercelLLMProvider({
  providerType: 'openai', // 或 'qwen', 'anthropic', 'mistral', 'google'
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-3.5-turbo',
});

// 使用 generateStream 方法
const prompt = '请写一个关于人工智能的短文。';
for await (const chunk of llmProvider.generateStream(prompt)) {
  process.stdout.write(chunk); // 实时输出每个文本块
}

// 使用 chatStream 方法
const message = '什么是机器学习？';
for await (const chunk of llmProvider.chatStream(message)) {
  process.stdout.write(chunk); // 实时输出每个文本块
}
```

### 2. 在 Action 中使用流式响应

MetaGPT-TS 的 `BaseAction` 类提供了 `askStream` 方法，可以在 Action 中使用流式响应：

```typescript
class MyAction extends BaseAction {
  async runStream(callback?: (chunk: string) => void): Promise<ActionOutput> {
    try {
      // 构建提示词
      const prompt = '请生成一个产品需求文档...';
      
      // 使用流式响应
      let fullResponse = '';
      for await (const chunk of this.askStream(prompt)) {
        fullResponse += chunk;
        if (callback) {
          callback(chunk);
        }
      }
      
      return this.createOutput(fullResponse, 'completed');
    } catch (error) {
      return this.createOutput(`Error: ${error}`, 'failed');
    }
  }
}
```

### 3. 在 Role 中使用流式响应

可以扩展 `BaseRole` 类，添加流式响应支持：

```typescript
class StreamingRole extends BaseRole {
  async runWithStreaming(
    message: Message, 
    streamCallback?: (chunk: string, actionName: string) => void
  ): Promise<Message> {
    // 决定要执行的 Action
    const action = await this.decideNextAction(message);
    
    if (!action) {
      return this.createMessage('No suitable action found.');
    }
    
    // 检查 Action 是否支持流式响应
    if ('runStream' in action && typeof action.runStream === 'function') {
      let fullResponse = '';
      const result = await (action as any).runStream((chunk: string) => {
        fullResponse += chunk;
        if (streamCallback) {
          streamCallback(chunk, action.name);
        }
      });
      
      // 创建响应消息
      const responseMessage = this.createMessage(
        result.content || 'No output from action'
      );
      
      return responseMessage;
    } else {
      // 回退到非流式方法
      const result = await action.run();
      return this.createMessage(result.content);
    }
  }
}
```

## 示例

### 基本流式响应示例

```typescript
import { VercelLLMProvider } from '../src/provider/vercel-llm';

async function main() {
  // 初始化 LLM 提供商
  const llmProvider = new VercelLLMProvider({
    providerType: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-3.5-turbo',
  });
  
  // 设置系统提示
  llmProvider.setSystemPrompt('你是一位专业的助手。');
  
  // 准备提示词
  const prompt = '请写一个关于人工智能的短文。';
  
  console.log('开始生成流式响应...');
  
  // 使用 generateStream 方法获取流式响应
  let fullResponse = '';
  for await (const chunk of llmProvider.generateStream(prompt)) {
    process.stdout.write(chunk); // 实时输出每个文本块
    fullResponse += chunk;
  }
  
  console.log('\n\n流式响应结束');
  console.log(`总共生成了 ${fullResponse.length} 个字符`);
}

main().catch(console.error);
```

### 产品经理角色流式响应示例

请参考 `metagpt-ts/examples/product-manager-streaming-example.ts` 文件，该文件展示了如何在产品经理角色中使用流式响应功能。

## 注意事项

1. 流式响应需要 LLM 提供商支持，目前支持的提供商包括：
   - OpenAI
   - Qwen (百炼)
   - Anthropic
   - Mistral
   - Google

2. 使用流式响应时，需要确保网络连接稳定，否则可能会导致流中断。

3. 流式响应适合用于生成长文本内容，如文档、报告等，对于短文本，可能不会带来明显的体验提升。

4. 在处理流式响应时，需要注意内存使用，特别是当生成非常长的内容时。

## 技术实现

MetaGPT-TS 的流式响应功能基于 Vercel AI SDK 的 `streamText` 函数实现，该函数返回一个包含 `textStream` 的对象，可以通过 `for await...of` 循环获取每个文本块。

```typescript
const { streamText } = await import('ai');

const streamResult = await streamText({
  model,
  prompt,
  // 其他配置...
});

const textStream = streamResult.textStream;

for await (const chunk of textStream) {
  // 处理每个文本块
}
``` 