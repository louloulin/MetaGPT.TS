# TutorialAssistant - MetaGPT-TS

本文档介绍了 MetaGPT TypeScript 实现中的教程助手模块，该模块可以根据简单的一句话描述生成完整的 Markdown 格式教程文档。

## 功能概述

TutorialAssistant（教程助手）是一个专门用于生成教程文档的角色。它能够：

1. 接收一个简单的主题句子作为输入
2. 自动生成结构化的教程目录
3. 为每个目录条目生成详细内容
4. 将完整的教程以 Markdown 格式保存到文件

该实现基于 MetaGPT 架构，使用 Actions（动作）来划分生成步骤，使用大型语言模型来生成高质量内容。

## 实现细节

TutorialAssistant 由以下主要组件组成：

1. **角色**：`TutorialAssistant` 类
2. **动作**：
   - `WriteDirectory` - 生成教程的目录结构
   - `WriteContent` - 根据目录结构生成每个部分的详细内容

### 目录结构

实现代码位于以下文件中：

- `src/roles/tutorial-assistant.ts` - 教程助手角色实现
- `src/actions/write-tutorial.ts` - 教程生成相关动作
- `examples/tutorial-assistant-example.ts` - 使用示例

## 使用方法

### 基本用法

```typescript
import { BailianLLMProvider } from '../src/provider/bailian-llm';
import { TutorialAssistant } from '../src/roles/tutorial-assistant';

// 初始化语言模型提供商
const llmProvider = new BailianLLMProvider({
  apiKey: 'your-api-key',
  secretKey: 'your-secret-key',
});

// 创建教程助手
const tutorialAssistant = new TutorialAssistant({
  llm: llmProvider,
  language: 'Chinese', // 或 'English'
  outputDir: './tutorials', // 可选，指定输出目录
});

// 生成教程
const result = await tutorialAssistant.react({
  role: 'user',
  content: '如何使用TypeScript开发Node.js应用', // 你的教程主题
  id: 'msg-1',
  causedBy: 'user-input',
  sentFrom: 'user',
  sendTo: new Set(['TutorialAssistant']),
});

console.log(result.content); // 显示结果消息
```

### 配置选项

`TutorialAssistant` 构造函数接受以下配置选项：

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| llm | LLMProvider | 是 | 语言模型提供商实例 |
| language | string | 否 | 生成文档的语言，默认为 'Chinese'，也可设为 'English' |
| outputDir | string | 否 | 生成文档的输出目录，默认为 './tutorials' |

## 输出示例

生成的教程文档示例：

```markdown
# TypeScript Node.js 应用开发教程

## 1. 介绍

### 1.1 什么是 TypeScript
TypeScript 是 JavaScript 的超集，添加了类型系统和对 ES6+ 特性的支持...

### 1.2 为什么在 Node.js 中使用 TypeScript
使用 TypeScript 开发 Node.js 应用有很多优势...

## 2. 环境设置

### 2.1 安装 Node.js 和 npm
首先，确保你的系统已安装 Node.js...

...（更多内容）
```

## 注意事项

1. 确保使用具有足够上下文长度的大型语言模型，以便生成完整、连贯的教程
2. 生成的文档会保存在指定的输出目录中，文件名包含教程标题和时间戳
3. 可以通过修改 `src/actions/write-tutorial.ts` 中的提示词模板来自定义生成的内容风格和格式

## 扩展与自定义

### 自定义提示词

你可以修改 `WriteDirectory` 和 `WriteContent` 动作中的 `generateDirectoryPrompt` 和 `generateContentPrompt` 方法以自定义提示词。

### 添加更多处理步骤

如果你想添加更多的处理步骤（如添加代码检查、图片生成等），可以创建新的 Action 类并将其添加到 TutorialAssistant 的动作列表中。 