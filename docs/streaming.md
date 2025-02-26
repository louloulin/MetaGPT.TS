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

### 4. 使用 TutorialAssistant 的流式响应

MetaGPT-TS 提供了 `TutorialAssistant` 角色，支持通过统一的 `run` 方法选择普通模式或流式模式生成教程文档：

```typescript
import { TutorialAssistant, RunMode } from '../src/roles/tutorial-assistant';

// 初始化 TutorialAssistant
const tutorialAssistant = new TutorialAssistant({
  llm: llmProvider,
  language: 'Chinese', // 或 'English'
  outputDir: './tutorials'
});

// 创建消息
const message = {
  id: '1',
  content: '如何使用TypeScript开发一个聊天机器人',
  role: 'user',
  causedBy: 'user',
  sentFrom: 'user',
  timestamp: new Date().toISOString(),
  sendTo: new Set(['*']),
  instructContent: null,
};

// 使用普通模式生成教程
const regularResult = await tutorialAssistant.run(message);
console.log(`教程已生成并保存到: ${regularResult.content}`);

// 使用流式模式生成教程
const streamingResult = await tutorialAssistant.run(message, {
  mode: RunMode.STREAMING,
  streamCallback: (chunk, sectionTitle) => {
    console.log(`[${sectionTitle}] ${chunk}`);
    // 可以在这里实时处理生成的内容，例如更新UI
  }
});
```

`TutorialAssistant` 的 `run` 方法接受两个参数：
- `message`: 包含教程主题的消息对象
- `options`: 可选的运行选项，包括：
  - `mode`: 运行模式，可以是 `RunMode.REGULAR`（默认）或 `RunMode.STREAMING`
  - `streamCallback`: 流式回调函数，仅在流式模式下使用

流式回调函数接收两个参数：
- `chunk`: 当前生成的文本块
- `sectionTitle`: 当前正在生成的章节标题

这种统一的接口设计使得你可以轻松地在普通模式和流式模式之间切换，而不需要调用不同的方法。

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

### 教程助手示例

`metagpt-ts/examples/tutorial-assistant-streaming-example.ts` 文件展示了如何使用 `TutorialAssistant` 的统一 `run` 方法，支持通过命令行参数选择普通模式或流式模式：

```typescript
// 从命令行参数确定运行模式
const useStreaming = process.argv.includes('--stream') || process.argv.includes('-s');
const runMode = useStreaming ? RunMode.STREAMING : RunMode.REGULAR;

// 根据模式运行教程助手
if (runMode === RunMode.STREAMING) {
  // 使用流式模式
  const result = await tutorialAssistant.run(message, {
    mode: RunMode.STREAMING,
    streamCallback: (chunk, sectionTitle) => {
      // 处理每个文本块
      process.stdout.write(chunk);
    }
  });
} else {
  // 使用普通模式
  const result = await tutorialAssistant.run(message);
}
```

运行示例：
```bash
# 普通模式
node dist/examples/tutorial-assistant-streaming-example.js

# 流式模式
node dist/examples/tutorial-assistant-streaming-example.js --stream
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

5. 对于复杂的角色（如 TutorialAssistant），流式响应可能只适用于部分步骤，例如内容生成，而不适用于结构化数据生成（如目录结构）。

6. 当设计支持流式响应的接口时，考虑提供统一的方法（如 TutorialAssistant 的 `run` 方法），通过选项参数来控制是否使用流式模式，这样可以提供更一致的用户体验。

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