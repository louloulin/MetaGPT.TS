# VercelLLMProvider - 多模型提供商支持

本文档介绍了基于 Vercel AI SDK 的通用 LLM 提供商实现，该实现支持多种模型提供商，包括 OpenAI、Qwen、Anthropic、Mistral 和 Google 等。

## 功能概述

`VercelLLMProvider` 是一个通用的语言模型提供商实现，它：

1. 支持多种模型提供商的统一接口
2. 动态加载所需的提供商模块，避免不必要的依赖
3. 允许轻松切换不同的模型提供商
4. 提供合理的默认配置和灵活的自定义选项
5. 实现了 MetaGPT 的 `LLMProvider` 接口

## 支持的提供商

目前支持以下模型提供商：

| 提供商类型 | 提供商包          | 默认模型                 |
|------------|-------------------|--------------------------|
| openai     | @ai-sdk/openai    | gpt-3.5-turbo            |
| qwen       | qwen-ai-provider  | qwen-plus                |
| anthropic  | @ai-sdk/anthropic | claude-3-sonnet-20240229 |
| mistral    | @ai-sdk/mistral   | mistral-large-latest     |
| google     | @ai-sdk/google    | gemini-pro               |
| custom     | 自定义            | 用户指定                 |

## 使用方法

### 基本用法

```typescript
import { VercelLLMProvider } from '../src/provider/vercel-llm';

// 使用 OpenAI
const openaiProvider = new VercelLLMProvider({
  providerType: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

// 使用 Qwen (百炼大模型)
const qwenProvider = new VercelLLMProvider({
  providerType: 'qwen',
  apiKey: process.env.QWEN_API_KEY,
  model: 'qwen-plus',
});

// 生成文本
const result = await openaiProvider.generate('Hello, world!');
console.log(result);
```

### 高级配置

您可以通过 `extraConfig` 字段提供额外的配置选项：

```typescript
const provider = new VercelLLMProvider({
  providerType: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  extraConfig: {
    // 生成选项，会传递给 generateText 方法
    generateOptions: {
      temperature: 0.7,
      maxTokens: 500,
    },
    // 自定义提供商的环境变量
    environmentVars: {
      CUSTOM_API_HOST: 'https://custom-api.example.com',
    },
  },
});
```

### 自定义提供商

您可以使用 `custom` 提供商类型来支持其他未内置的提供商：

```typescript
import { customProvider } from 'custom-provider-package';

const provider = new VercelLLMProvider({
  providerType: 'custom',
  apiKey: process.env.CUSTOM_API_KEY,
  extraConfig: {
    modelFunction: customProvider,
    defaultModel: 'custom-model-name',
    environmentVars: {
      CUSTOM_API_KEY: process.env.CUSTOM_API_KEY,
    },
  },
});
```

## 安装依赖

根据需要使用的模型提供商，您需要安装相应的依赖包：

```bash
# 安装核心依赖
bun add ai @ai-sdk/openai

# 按需安装其他提供商
bun add qwen-ai-provider
bun add @ai-sdk/anthropic
bun add @ai-sdk/mistral
bun add @ai-sdk/google
```

## API 参考

### ModelProviderConfig

配置对象的类型定义：

```typescript
export type ModelProviderType = 'openai' | 'qwen' | 'anthropic' | 'mistral' | 'google' | 'custom';

export type ModelProviderConfig = {
  providerType: ModelProviderType;
  apiKey: string;
  baseURL?: string;
  model?: string;
  extraConfig?: Record<string, any>;
};
```

### 方法

`VercelLLMProvider` 实现了 `LLMProvider` 接口的以下方法：

- **generate(prompt: string, config?: Partial<LLMConfig>): Promise<string>**
  生成文本响应

- **generateStream(prompt: string, config?: Partial<LLMConfig>): AsyncGenerator<string>**
  生成文本流，适用于实时响应

- **embed(text: string): Promise<number[]>**
  生成文本嵌入向量

## 扩展与自定义

### 添加新的提供商支持

要添加对新提供商的支持，您需要：

1. 在 `ModelProviderType` 中添加新的提供商类型
2. 在 `providerFunctions` 对象中添加新提供商的初始化
3. 在 `setupEnvironment` 方法中添加环境变量配置
4. 在 `loadProviderModules` 方法中添加动态导入逻辑
5. 在 `getDefaultModel` 方法中添加默认模型选择

## 故障排除

如果在使用过程中遇到问题，请检查：

1. 是否已安装所需的提供商包
2. 环境变量是否正确设置
3. 网络连接是否正常
4. 提供商服务是否可用

如果动态导入提供商失败，您会在控制台看到警告信息，提示安装相应的包。 