# MetaGPT.TS

> A TypeScript-based multi-agent collaboration framework that transforms large language models into efficient agents, building a collaborative software development team.


## 📖 文档 | Documentation

**[中文文档](README-CN.md)** | [English](README.md)

## Introduction

MetaGPT.TS is a modern TypeScript framework for building multi-agent systems. It transforms large language models (LLMs) into efficient agents that can collaborate as a software development team.

### Key Features
- **Agent Collaboration**: Built-in roles like Product Manager, Architect, and Engineer collaborate through standardized processes to complete complex tasks
- **End-to-End Support**: Intelligent support for the entire process from requirement analysis and system design to code implementation
- **High-Performance Architecture**: Based on modern TypeScript stack, providing efficient and type-safe development experience
- **Extensibility**: Support for custom roles, actions, and workflows to adapt to different application scenarios

## Quick Start

```bash
# Install with bun
bun install @louloulinx/metagpt

# Or with npm
npm install @louloulinx/metagpt
```

### Basic Configuration

```typescript
// Configure LLM provider
import { config } from "@louloulinx/metagpt";

config.OPENAI_API_KEY = "sk-..."; // Your API key
```

### Simple Example

```typescript
import { Team, ProductManager, Architect, Engineer } from "@louloulinx/metagpt";

// Create a team
const team = new Team();
team.hire([new ProductManager(), new Architect(), new Engineer()]);

// Execute project
await team.runProject("Implement a simple todo management application");
```

## Core Concepts

- **Role**: Task execution units with specific skills (Product Manager/Architect/Engineer)
- **Action**: Atomic operation units of agents
- **Team**: Organization of multiple roles working together
- **Memory**: Long-term memory storage with vector retrieval support

## Application Scenarios

- Agent-assisted development
- Automated workflow orchestration
- Complex task decomposition and execution
- AI team simulation and optimization
- Enterprise application intelligence transformation

## Core Features

1. **Multi-Role Collaboration** - Pre-configured roles including Product Manager, Architect, Engineer, etc.
2. **Automated Workflow** - Support for the entire process from requirement analysis to system design and code implementation
3. **Type Safety** - Strict TypeScript type checking
4. **Reactive Architecture** - Message pipeline processing based on RxJS
5. **Observability** - Built-in comprehensive logging and monitoring support

## Supported Models

| Provider  | Supported Versions     | Config Name        |
|-----------|------------------------|-------------------|
| OpenAI    | gpt-4/gpt-3.5-turbo    | OPENAI_API_KEY    |
| Anthropic | Claude-2               | ANTHROPIC_API_KEY |
| Azure     | GPT-4                  | AZURE_API_KEY     |

## Project Structure

```
metagpt/
├── src/
│   ├── actions/      # Action definitions and implementations
│   ├── roles/        # Role definitions and behaviors
│   ├── utils/        # Utility functions and helper classes
│   ├── config/       # Configuration management
│   ├── memory/       # Memory and state management
│   ├── provider/     # LLM provider integration
│   ├── tools/        # External tool integration
│   ├── skills/       # Skill implementations
│   ├── rag/          # Retrieval-augmented generation
│   ├── document/     # Document processing and management
│   └── types/        # TypeScript type definitions
├── tests/            # Test files
├── examples/         # Example implementations
└── package.json      # Project dependencies and scripts
```

## Environment Configuration

MetaGPT.TS supports environment variable configuration through `.env` files for easy management of API keys and other configuration items.

1. Create a `.env` file in the project root directory:

```
# LLM provider configuration
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_API_MODEL=gpt-4-turbo
OPENAI_API_BASE=https://api.openai.com/v1

# Optional other LLM providers
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
AZURE_API_KEY=your-azure-api-key
AZURE_API_BASE=your-azure-endpoint

# Vector storage configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-qdrant-api-key

# Logging configuration
LOG_LEVEL=info # debug, info, warn, error

# Application settings
MAX_TOKENS=4000
TEMPERATURE=0.7
PROJECT_ROOT=./workspace
```

2. Or configure directly in code (not recommended):

```typescript
// Configure LLM provider (OpenAI example)
import { config } from "@louloulinx/metagpt";

config.OPENAI_API_KEY = "sk-..."; // Your API key
config.OPENAI_API_MODEL = "gpt-4-1106-preview"; // Model version
```

## Tutorial Assistant Example

The Tutorial Assistant is a specialized role that can generate comprehensive tutorial documents in Markdown format.

```typescript
import { VercelLLMProvider } from '@louloulinx/metagpt';
import { TutorialAssistant } from '@louloulinx/metagpt';
import { v4 as uuidv4 } from 'uuid';

/**
 * 教程助手示例
 * 
 * 该示例演示如何使用教程助手生成Markdown格式的教程文档
 */
async function main() {
  console.log(`🚀 开始执行教程生成 [${new Date().toISOString()}]`);
  
  try {
    // 从环境变量获取API密钥
    const apiKey = process.env.DASHSCOPE_API_KEY;
    console.log('✓ 检查环境变量');
    
    if (!apiKey) {
      console.error('❌ 错误: 请设置环境变量: DASHSCOPE_API_KEY');
      process.exit(1);
    }
    console.log('✓ 环境变量已设置');
    
    // 初始化Vercel LLM提供商 - 使用百炼大模型(qwen)
    console.log('⚙️ 配置百炼大模型...');
    const llmProvider = new VercelLLMProvider({
      providerType: 'qwen',
      apiKey,
      model: 'qwen-plus-2025-01-25',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', // 自定义API端点
      extraConfig: {
        qwenOptions: {
          debug: true, // 启用调试日志
        },
        generateOptions: {
          system: '你是一位专业的教程编写专家，擅长生成高质量、结构清晰的教程文档。'
        }
      }
    });
    console.log(`✓ 模型配置完成: ${llmProvider.config?.providerType} - ${llmProvider.config?.model}`);
    
    console.log('⚙️ 初始化教程助手...');
    console.time('教程助手初始化时间');
    
    // 创建教程助手
    const tutorialAssistant = new TutorialAssistant({
      llm: llmProvider,
      language: 'Chinese', // 可选: 'English'
      outputDir: './output/tutorials', // 可选，默认为 './tutorials'
    });
    
    console.timeEnd('教程助手初始化时间');
    console.log('✓ 教程助手初始化完成');
    
    // 设置要生成的教程主题
    const topic = '西方经济学考研复试资料';
    console.log(`📝 生成主题: "${topic}"`);
    
    // 生成教程
    console.log('🔄 开始生成教程...');
    console.log('👉 步骤 1: 生成目录结构');
    console.time('教程生成总时间');
    
    const result = await tutorialAssistant.react({
      id: uuidv4(),
      role: 'user',
      content: topic,
      sentFrom: 'user',
      sendTo: new Set(['*']),
      instructContent: null,
    });
    
    console.timeEnd('教程生成总时间');
    console.log('✅ 教程生成完成!');
    
    // 提取文件路径（假设结果消息中包含文件路径信息）
    const filePath = result.content.includes('saved to') 
      ? result.content.split('saved to ')[1].trim()
      : '未找到文件路径';
    
    console.log(`📄 生成结果: ${result.content}`);
    console.log(`📂 输出文件: ${filePath}`);
    console.log(`🏁 教程生成完成 [${new Date().toISOString()}]`);
  } catch (error) {
    console.error('❌ 生成教程时出错:', error);
    if (error instanceof Error) {
      console.error(`错误类型: ${error.name}`);
      console.error(`错误信息: ${error.message}`);
      console.error(`错误堆栈: ${error.stack}`);
    }
  }
}

// 运行示例
console.log('📌 教程助手示例');
main(); 
```



## Basic Usage Example (Coming Soon)

```typescript
import { Team, ProductManager, Architect, Engineer } from "@louloulinx/metagpt/roles";
import { Message } from "@louloulinx/metagpt";

async function startup(idea: string) {
  // Initialize team
  const company = new Team();
  
  // Build team
  company.hire([
    new ProductManager(),
    new Architect(),
    new Engineer(),
  ]);

  // Set initial parameters
  company.invest(3.0); // Set budget (virtual currency)
  
  // Run project
  const messages: Message[] = await company.runProject(
    idea,
    { maxRounds: 5 }
  );

  return messages;
}

// Execute example
await startup("Implement a command-line Reversi game");
```

## Technical Stack

### Core Technology Stack
1. Runtime & Package Manager
   - Bun.js: High-performance JavaScript runtime with built-in package manager
   - Node.js 18+ compatibility support

2. Development Language and Framework
   - TypeScript 5.0+: Strong type support
   - Zod: Runtime type validation
   - XState: State machine management
   - RxJS: Reactive programming

3. Testing and Development Tools
   - bun:test: Unit testing framework
   - ESLint + Prettier: Code standards
   - TypeDoc: API documentation generation

4. Core Dependencies
   - Vercel AI SDK
   - Qdrant Node Client: Vector storage
   - Winston: Log management

## Roadmap

### Core Architecture Evolution
1. Strengthen Type System
   - Implement runtime type validation
   - Enhance generic support
   - Improve pattern matching mechanism

2. Performance Optimization
   - Message pipeline performance benchmarking
   - Memory management optimization
   - Asynchronous task scheduling improvements

3. Extensibility Enhancement
   - Modular architecture refactoring
   - Dynamic plugin loading mechanism
   - Hot update support

### Ecosystem Building
1. Developer Toolchain
   - CLI tool enhancement
   - Visual debugger
   - Performance analysis tools

2. Templates and Examples
   - Create common scenario templates
   - Add enterprise-level examples
   - Build example library

3. Integration Support
   - Mainstream frontend framework adaptation
   - Node.js runtime optimization
   - Deno/Bun deep integration

## Acknowledgements

The design of metagpt.ts references the implementation logic of [MetaGPT](https://github.com/geekan/MetaGPT), for which we are grateful.


