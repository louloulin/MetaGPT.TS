# MetaGPT.TS


## 中文说明

> MetaGPT.TS是一个基于TypeScript的多智能体协作框架，将大语言模型转化为高效能智能体，构建可协作的软件开发团队。

### 项目特点
- **智能体协作**：内置产品经理、架构师、工程师等多种角色智能体，通过标准化流程协作完成复杂任务
- **全流程支持**：从需求分析、系统设计到代码实现的全流程智能支持
- **高性能架构**：基于现代TypeScript技术栈，提供高效、类型安全的开发体验
- **可扩展性**：支持自定义角色、动作和工作流，灵活适应不同应用场景

### 快速开始
```bash
# 使用 bun 安装
bun install metagpt

# 或使用 npm
npm install metagpt
```

### 基础配置
```typescript
// 配置LLM提供商
import { config } from "metagpt/config";

config.OPENAI_API_KEY = "sk-..."; // 你的API密钥
```

### 简单示例
```typescript
import { Team, ProductManager, Architect, Engineer } from "metagpt/roles";

// 创建团队
const team = new Team();
team.hire([new ProductManager(), new Architect(), new Engineer()]);

// 执行项目
await team.runProject("实现一个简单的待办事项管理应用");
```

---

## Introduction

> MetaGPT TypeScript is a multi-agent collaboration framework that transforms LLMs into efficient agents, building a collaborative software development team.

> 将大语言模型转化为高效能智能体，构建可协作的软件开发团队

**MetaGPT TypeScript 版** 是一个基于现代 TypeScript 技术栈的多智能体框架，主要特性包括：

## 项目简介
- **智能体即软件**：通过角色定义将LLM转化为可执行特定任务的智能体
- **标准化协作**：内置软件公司标准操作流程（SOP），实现智能体间高效协作
- **全栈式架构**：包含需求分析、系统设计、代码实现、测试部署的全生命周期支持

## 核心特性
- 多智能体协作系统
- 支持 RAG 的增强型记忆机制
- 可观测的智能体状态管理
- 可视化的工作流追踪
- 企业级扩展能力
- 完整的类型安全保证

## 核心概念
- **角色 (Role)**：具备特定技能的任务执行单元（产品经理/架构师/工程师）
- **动作 (Action)**：智能体的原子化操作单元
- **团队 (Team)**：多角色协作的智能体组织
- **记忆 (Memory)**：支持向量检索的长期记忆存储

## 应用场景
- 智能体辅助开发
- 自动化工作流编排
- 复杂任务分解执行
- AI团队模拟与优化
- 企业级应用智能化改造

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/geekan/MetaGPT)


### 核心功能特性
1. **多角色协作** - 预置产品经理/架构师/工程师等角色
2. **自动工作流** - 支持需求分析/系统设计/代码实现全流程
3. **类型安全** - 严格的TypeScript类型校验
4. **响应式架构** - 基于RxJS的消息管道处理
5. **可观测性** - 内置完整的日志和监控支持

### 支持模型
| 提供商      | 支持版本                | 配置项名称          |
|-----------|-----------------------|-------------------|
| OpenAI    | gpt-4/gpt-3.5-turbo   | OPENAI_API_KEY    |
| Anthropic | Claude-2              | ANTHROPIC_API_KEY |
| Azure     | GPT-4                 | AZURE_API_KEY     |


## 1. 项目结构 ✅

```
metagpt/
├── src/
│   ├── actions/      # 动作定义和实现 ✅
│   ├── roles/        # 角色定义和行为 ✅
│   ├── utils/        # 工具函数和辅助类 ✅
│   ├── config/       # 配置管理 ✅
│   ├── memory/       # 记忆和状态管理 ✅
│   ├── provider/     # LLM提供商集成 ✅
│   ├── tools/        # 外部工具集成 ✅
│   ├── skills/       # 技能实现 ✅
│   ├── rag/          # 检索增强生成 ✅
│   ├── document/     # 文档处理和管理 ✅
│   └── types/        # TypeScript类型定义 ✅
├── tests/            # 测试文件 ✅
├── examples/         # 示例实现
└── package.json      # 项目依赖和脚本 ✅
```

### 环境配置
### 环境变量配置

MetaGPT.TS 支持通过 `.env` 文件配置环境变量，便于管理API密钥和其他配置项。

1. 在项目根目录创建 `.env` 文件：

```
# LLM 提供商配置
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_API_MODEL=gpt-4-turbo
OPENAI_API_BASE=https://api.openai.com/v1

# 可选的其他 LLM 提供商
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
AZURE_API_KEY=your-azure-api-key
AZURE_API_BASE=your-azure-endpoint

# 向量存储配置
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-qdrant-api-key

# 日志配置
LOG_LEVEL=info # debug, info, warn, error

# 应用设置
MAX_TOKENS=4000
TEMPERATURE=0.7
PROJECT_ROOT=./workspace
```

2. 或在代码中直接配置（不推荐）：

```typescript
// 配置LLM提供商（以OpenAI为例）
import { config } from "metagpt/config";

config.OPENAI_API_KEY = "sk-..."; // 你的API密钥
config.OPENAI_API_MODEL = "gpt-4-1106-preview"; // 模型版本
```

### 基础使用示例(待实现)
```typescript
import { Team, ProductManager, Architect, Engineer } from "metagpt/roles";
import { Message } from "metagpt/types";

async function startup(idea: string) {
  // 初始化团队
  const company = new Team();
  
  // 组建团队
  company.hire([
    new ProductManager(),
    new Architect(),
    new Engineer(),
  ]);

  // 设置初始参数
  company.invest(3.0); // 设置预算（虚拟货币）
  
  // 运行项目
  const messages: Message[] = await company.runProject(
    idea,
    { maxRounds: 5 }
  );

  return messages;
}

// 执行示例
await startup("实现一个命令行黑白棋游戏");
```


### 环境配置

MetaGPT.TS 支持通过 `.env` 文件配置环境变量，便于管理API密钥和其他配置项。

1. 在项目根目录创建 `.env` 文件：

```
# LLM 提供商配置
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_API_MODEL=gpt-4-turbo
OPENAI_API_BASE=https://api.openai.com/v1

# 可选的其他 LLM 提供商
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
AZURE_API_KEY=your-azure-api-key
AZURE_API_BASE=your-azure-endpoint

# 向量存储配置
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-qdrant-api-key

# 日志配置
LOG_LEVEL=info # debug, info, warn, error

# 应用设置
MAX_TOKENS=4000
TEMPERATURE=0.7
PROJECT_ROOT=./workspace
```

2. 或在代码中直接配置（不推荐）：

```typescript
// 配置LLM提供商（以OpenAI为例）
import { config } from "metagpt/config";

config.OPENAI_API_KEY = "sk-..."; // 你的API密钥
config.OPENAI_API_MODEL = "gpt-4-1106-preview"; // 模型版本
```

### 基础使用示例(待实现)
```typescript
import { Team, ProductManager, Architect, Engineer } from "metagpt/roles";
import { Message } from "metagpt/types";

async function startup(idea: string) {
  // 初始化团队
  const company = new Team();
  
  // 组建团队
  company.hire([
    new ProductManager(),
    new Architect(),
    new Engineer(),
  ]);

  // 设置初始参数
  company.invest(3.0); // 设置预算（虚拟货币）
  
  // 运行项目
  const messages: Message[] = await company.runProject(
    idea,
    { maxRounds: 5 }
  );

  return messages;
}

// 执行示例
await startup("实现一个命令行黑白棋游戏");
```





## 2. 技术选型 ✅

### 核心技术栈 ✅
1. Runtime & Package Manager
   - Bun.js: 高性能 JavaScript runtime，内置包管理器 ✅
   - Node.js 18+ 兼容性支持 ✅

2. 开发语言与框架
   - TypeScript 5.0+：强类型支持 ✅
   - Zod：运行时类型验证 ✅
   - XState：状态机管理 ✅
   - RxJS：响应式编程 ✅

3. 测试与开发工具
   - bun:test：单元测试框架 ✅
   - ESLint + Prettier：代码规范 ✅
   - TypeDoc：API 文档生成 ✅

4. 核心依赖
   - Vercel AI SDK ✅
   - Qdrant Node Client：向量存储 ✅
   - Winston：日志管理 ✅

### 技术特性
1. 状态管理
   - 使用 XState 实现角色状态机 ✅
   - RxJS 处理异步消息流 ✅
   - 响应式的内存管理 ✅

2. 类型系统
   - 严格的 TypeScript 类型 ✅
   - Zod schema 验证 ✅
   - 运行时类型检查 ✅

3. 异步处理
   - 基于 Promise 和 async/await ✅
   - RxJS Observable 消息流 ✅
   - 事件驱动架构 ✅

## 3. 核心接口设计 ✅

### 基础消息系统 ✅
```typescript
interface Message {
  id: string;
  content: string;
  role: string;
  causedBy: string;
  sentFrom: string;
  sendTo: Set<string>;
  instructContent?: any;
}

interface MessageQueue {
  push(msg: Message): void;
  pop(): Promise<Message | null>;
  popAll(): Promise<Message[]>;
  empty(): boolean;
}
```

### 角色系统 ✅
```typescript
interface Role {
  name: string;
  profile: string;
  goal: string;
  constraints: string;
  actions: Action[];
  
  // 核心方法
  observe(): Promise<number>;
  think(): Promise<boolean>;
  act(): Promise<Message>;
  react(): Promise<Message>;
  
  // 状态管理
  state: number;
  context: RoleContext;
}

interface RoleContext {
  memory: Memory;
  workingMemory: Memory;
  state: number;
  todo: Action | null;
  watch: Set<string>;
  reactMode: RoleReactMode;
}
```

### 动作系统 ✅
```typescript
interface Action {
  name: string;
  context: ActionContext;
  llm: LLMProvider;
  
  run(): Promise<ActionOutput>;
  handleException(error: Error): Promise<void>;
}

interface ActionOutput {
  content: string;
  status: ActionStatus;
  instruct_content?: any;
}
```

### 状态机定义 ✅
```typescript
interface RoleStateMachine {
  states: {
    idle: {};
    observing: {};
    thinking: {};
    acting: {};
    reacting: {};
  };
  
  events: {
    OBSERVE: {};
    THINK: {};
    ACT: {};
    REACT: {};
    COMPLETE: {};
  };
}
```

## 4. 核心组件迁移优先级

### 第一阶段：基础框架 ✅
1. 基本项目设置 ✅
   - 初始化TypeScript项目 ✅
   - 设置开发环境(ESLint, Prettier, Jest) ✅
   - 定义基础接口和类型 ✅
   - 实现核心工具类 ✅

2. 基础组件 ✅
   - 上下文和配置管理 ✅
   - 基本LLM提供商集成 ✅
   - 文档和记忆管理基础 ✅

### 第二阶段：核心功能 ✅
1. 角色系统 ✅
   - 基础角色类实现 ✅
   - 角色生命周期管理 ✅
   - 消息处理系统 ✅

2. 动作系统 ✅
   - 动作基类 ✅
   - 动作执行框架 ✅
   - 消息和状态管理 ✅

3. 记忆系统 ✅
   - 工作记忆实现 ✅
   - 长期记忆实现 ✅
   - 记忆管理器 ✅
   - 记忆整合和遗忘 ✅
   - 单元测试覆盖 ✅

### 第三阶段：高级功能 ✅
1. 技能和工具 ✅
   - 技能系统实现 ✅
   - 工具集成框架 ✅
   - RAG实现 ✅

2. 团队和管理 ✅
   - 团队协调 ✅
   - 任务管理 ✅
   - 工作流编排 ✅

### 第四阶段：完善和优化
1. WebSocket支持 ✅
   - WebSocket服务器实现 ✅
   - WebSocket客户端实现 ✅
   - 消息类型和验证 ✅
   - 流式传输支持 ✅
   - 错误处理和重连 ✅
   - 单元测试覆盖 ✅
2. 浏览器兼容性 ✅
   - 浏览器WebSocket客户端 ✅
   - 原生WebSocket API支持 ✅
   - 跨浏览器兼容性测试 ✅
   - 单元测试覆盖 ✅
3. 插件系统 ✅
   - 插件接口定义 ✅
   - 插件生命周期管理 ✅
   - 插件依赖管理 ✅
   - 插件配置管理 ✅
   - 钩子系统实现 ✅
   - 错误处理机制 ✅
   - 单元测试覆盖 ✅
4. 监控和可观测性 ✅
   - [x] 指标收集（计数器、仪表盘、直方图、摘要）
   - [x] 分布式追踪（跨度、事件、错误跟踪）
   - [x] 结构化日志（级别、上下文）
   - [x] 单元测试覆盖

## 5. 技术决策 ✅

### TypeScript配置 ✅
- 目标: ES2020+ ✅
- 启用严格类型检查 ✅
- ESM模块 ✅
- Node.js 18+支持 ✅

### 依赖 ✅
- OpenAI API客户端 ✅
- 向量存储(Milvus/Qdrant客户端) ✅
- 文档处理库 ✅
- 测试框架(Jest) ✅
- 日志(Winston/Pino) ✅

### 架构改进 ✅
1. 增强类型安全 ✅
   - 严格类型定义 ✅
   - 运行时类型验证 ✅
   - 接口优先设计 ✅

2. 现代JavaScript特性 ✅
   - 全面使用async/await ✅
   - ES模块 ✅
   - 装饰器用于角色和动作定义 ✅

3. 开发者体验 ✅
   - 更好的IDE集成 ✅
   - 改进的错误消息 ✅
   - 完整的文档 ✅

## 6. 实现策略 ✅

### 步骤1：项目设置 ✅
1. 初始化package.json ✅
2. 配置TypeScript ✅
3. 设置开发工具 ✅
4. 创建基本项目结构 ✅

### 步骤2：核心实现 ✅
1. 移植基础工具和辅助函数 ✅
2. 实现配置系统 ✅
3. 创建基类和接口 ✅
4. 设置LLM提供商集成 ✅

### 步骤3：角色系统 ✅
1. 实现角色基类 ✅
2. 移植基本角色 ✅
3. 设置消息处理 ✅
4. 实现状态管理 ✅

### 步骤4：动作和技能 ✅
1. 创建动作框架 ✅
2. 移植基本动作 ✅
3. 实现技能系统 ✅
4. 添加工具集成 ✅

### 步骤5：高级功能 ✅
1. 实现RAG系统 ✅
2. 添加团队管理 ✅
3. 创建工作流编排 ✅
4. 移植剩余功能 ✅

## 7. 测试策略 ✅
1. 单元测试(Vitest) ✅
2. 集成测试 ✅
3. E2E测试 ✅
4. 性能基准测试 ✅

## 8. 文档
1. API文档 ✅
   - TypeDoc配置 ✅
   - JSDoc注释 ✅
   - API参考文档生成 ✅
2. 使用示例
3. 迁移指南
4. 最佳实践

## 9. 兼容性考虑
1. 尽可能保持API兼容性 ✅
2. 记录破坏性变更 ✅
3. 提供迁移工具
4. 支持渐进式采用

## 10. 未来增强
1. WebSocket支持 ✅
2. 浏览器兼容性 ✅
3. 插件系统 ✅
4. 增强监控和可观察性


## 11. 智能体实现规划

### 基础智能体架构
1. 智能体核心框架
   - [x] 基础智能体接口定义
   - [x] 智能体生命周期管理
   - [x] 智能体状态机实现
   - [x] 智能体通信协议

2. 认知模型集成
   - [x] LLM推理引擎
   - [x] 上下文管理系统
   - [x] 提示工程框架
   - [x] 思维链(CoT)支持

3. 感知与交互
   - [x] 输入处理管道
   - [x] 输出格式化系统
   - [x] 多模态输入适配器
   - [x] 反馈处理机制

### 专业智能体实现
1. 开发团队智能体
   - [x] 产品经理(ProductManager)
   - [x] 架构师(Architect)
   - [x] 工程师(Engineer)
   - [x] 测试工程师(QAEngineer)
   - [ ] DevOps工程师(DevOpsEngineer)
   - [ ] 安全专家(SecurityExpert)

2. 创意与内容智能体
   - [ ] 内容创作者(ContentCreator)
   - [ ] 设计师(Designer)
   - [ ] 营销专家(MarketingExpert)
   - [ ] 数据分析师(DataAnalyst)

3. 领域专家智能体
   - [ ] 金融顾问(FinancialAdvisor)
   - [ ] 法律顾问(LegalAdvisor)
   - [ ] 医疗顾问(MedicalAdvisor)
   - [ ] 教育专家(EducationExpert)

### 高级智能体能力
1. 自主学习系统
   - [ ] 经验累积机制
   - [ ] 知识蒸馏框架
   - [ ] 自我评估系统
   - [ ] 能力进化机制

2. 协作增强
   - [ ] 智能体协商协议
   - [ ] 冲突解决机制
   - [ ] 任务分配优化
   - [ ] 集体智慧聚合

3. 自适应能力
   - [ ] 环境感知系统
   - [ ] 目标调整机制
   - [ ] 策略适应框架
   - [ ] 资源优化分配

### 智能体生态系统
1. 智能体市场
   - [ ] 智能体发现机制
   - [ ] 能力评级系统
   - [ ] 智能体组合推荐
   - [ ] 使用分析与优化

2. 自定义智能体工具
   - [ ] 智能体设计器
   - [ ] 行为编程接口
   - [ ] 能力组合系统
   - [ ] 性能测试框架

3. 智能体治理
   - [ ] 行为监控系统
   - [ ] 安全边界实施
   - [ ] 伦理准则执行
   - [ ] 隐私保护机制


## 12. 智能编程助手
### 代码智能体
1. 代码生成与补全
   - [ ] 上下文感知代码生成
   - [ ] 智能代码补全系统
   - [ ] 多语言支持框架
   - [ ] 代码风格适应机制

2. 代码理解与分析
   - [ ] 代码语义理解引擎
   - [ ] 依赖关系分析器
   - [ ] 代码质量评估系统
   - [ ] 性能瓶颈识别

3. 重构与优化
   - [ ] 自动代码重构建议
   - [ ] 设计模式识别与应用
   - [ ] 代码简化与优化
   - [ ] 技术债务识别

### 开发流程增强
1. 需求转代码
   - [ ] 自然语言需求解析
   - [ ] 需求到设计映射
   - [ ] 设计到代码转换
   - [ ] 一致性验证机制

2. 测试与调试
   - [ ] 自动测试生成
   - [ ] 边界条件识别
   - [ ] 智能调试建议
   - [ ] 错误根因分析

3. 文档与知识
   - [ ] 自动文档生成
   - [ ] 代码注释增强
   - [ ] API使用示例生成
   - [ ] 知识库集成

### 协作编程体验
1. 多人协作
   - [ ] 代码意图理解
   - [ ] 冲突预测与解决
   - [ ] 代码审查助手
   - [ ] 团队知识共享

2. 上下文感知
   - [ ] 项目结构理解
   - [ ] 代码历史分析
   - [ ] 开发者意图推断
   - [ ] 工作流适应

3. 学习与成长
   - [ ] 个性化编程建议
   - [ ] 技能差距分析
   - [ ] 学习路径推荐
   - [ ] 编程模式教学




## 12. 后续规划

### 核心架构演进
1. 强化类型系统
   - [ ] 实现运行时类型验证
   - [ ] 增强泛型支持
   - [ ] 完善模式匹配机制

2. 性能优化
   - [ ] 消息管道性能基准测试
   - [ ] 内存管理优化
   - [ ] 异步任务调度改进

3. 可扩展性增强
   - [ ] 模块化架构重构
   - [ ] 动态插件加载机制
   - [ ] 热更新支持

### 生态系统建设
1. 开发者工具链
   - [ ] CLI工具增强
   - [ ] 可视化调试器
   - [ ] 性能分析工具

2. 模板与示例
   - [ ] 创建常用场景模板
   - [ ] 添加企业级示例
   - [ ] 构建示例库

3. 集成支持
   - [ ] 主流前端框架适配
   - [ ] Node.js运行时优化
   - [ ] Deno/Bun深度集成

### 智能化演进
1. 自适应学习
   - [ ] 实现经验记忆库
   - [ ] 添加自我优化机制
   - [ ] 构建反馈循环系统

2. 多模态支持
   - [ ] 图像处理管道
   - [ ] 音频交互支持
   - [ ] 视频分析集成

3. 决策优化
   - [ ] 强化学习集成
   - [ ] 成本控制模块
   - [ ] 风险评估系统


在metagpt.ts的设计上，参考了[MetaGPT](https://github.com/geekan/MetaGPT)的实现逻辑，特此感谢。


