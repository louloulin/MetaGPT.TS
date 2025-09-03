# Action Orchestration System

## 概述

MetaGPT.TS 的动作编排系统是一个强大的工作流管理框架，支持复杂的动作编排、依赖管理、并行执行和错误处理。该系统基于 TypeScript 设计，充分利用类型安全特性，提供企业级的可靠性和性能。

## 核心组件

### ActionNode

`ActionNode` 是动作编排系统的基础单元，每个节点代表一个可执行的动作。

**主要特性：**
- 🎯 **类型安全**：完整的 TypeScript 类型支持
- 🔗 **依赖管理**：支持复杂的依赖关系和循环依赖检测
- 🚀 **多种执行模式**：Simple、Complex、Parallel
- 📝 **多种输出格式**：JSON、Markdown、Raw、XML、Code
- ✅ **结果验证**：自定义验证函数支持
- 💾 **结果缓存**：智能缓存机制提高性能
- 🔄 **回滚支持**：事务性操作和错误恢复
- 📊 **性能监控**：执行时间统计和指标收集

### ActionOrchestrator

`ActionOrchestrator` 负责管理和执行多个 ActionNode，提供工作流编排能力。

**主要特性：**
- 🔀 **多种执行模式**：Sequential、Parallel、Mixed
- 🎛️ **并发控制**：可配置的最大并发数
- 🔄 **自动重试**：支持指数退避的重试机制
- 🛡️ **错误处理**：继续执行或快速失败策略
- 📈 **执行历史**：完整的执行记录和统计
- 🎨 **可视化支持**：DOT 格式的工作流图
- 💾 **序列化支持**：完整的状态持久化

## 快速开始

### 基础用法

```typescript
import { ActionNode, ActionOrchestrator, OrchestrationMode, FillMode } from '@metagpt/core';

// 创建动作节点
const analysisNode = new ActionNode({
  key: 'analysis',
  expectedType: 'object',
  instruction: '分析用户需求并提取关键信息',
  example: { requirements: ['功能1', '功能2'], priority: 'high' },
  enableCache: true
});

// 创建编排器
const orchestrator = new ActionOrchestrator({
  id: 'user-analysis-workflow',
  mode: OrchestrationMode.SEQUENTIAL,
  maxConcurrency: 3,
  autoRollback: true
});

// 添加节点
orchestrator.addNode(analysisNode);

// 执行工作流
const result = await orchestrator.execute({
  llm: myLLMProvider,
  context: '用户需要一个项目管理系统',
  fillMode: FillMode.JSON
});
```

### 复杂工作流示例

```typescript
// 创建多个相关节点
const requirementsNode = new ActionNode({
  key: 'requirements',
  expectedType: 'object',
  instruction: '分析需求',
  example: { features: [], priority: 'high' }
});

const designNode = new ActionNode({
  key: 'design',
  expectedType: 'object',
  instruction: '设计架构',
  example: { architecture: 'microservices' },
  validator: (result) => result.architecture && result.components
});

const codeNode = new ActionNode({
  key: 'code',
  expectedType: 'string',
  instruction: '生成代码',
  example: 'class Example {}',
  rollback: async (result) => {
    // 清理生成的代码文件
    console.log('Rolling back code generation...');
  }
});

// 设置依赖关系
orchestrator.addNode(requirementsNode);
orchestrator.addNode(designNode);
orchestrator.addNode(codeNode);

orchestrator.addDependency('requirements', 'design');
orchestrator.addDependency('design', 'code');
```

## 高级功能

### 并行执行

```typescript
const parallelOrchestrator = new ActionOrchestrator({
  id: 'parallel-processing',
  mode: OrchestrationMode.PARALLEL,
  maxConcurrency: 5,
  continueOnError: true
});

// 添加独立的并行任务
parallelOrchestrator.addNode(dataValidationNode);
parallelOrchestrator.addNode(dataTransformationNode);
parallelOrchestrator.addNode(dataEnrichmentNode);
```

### 错误处理和回滚

```typescript
const robustOrchestrator = new ActionOrchestrator({
  id: 'robust-workflow',
  mode: OrchestrationMode.SEQUENTIAL,
  autoRollback: true,
  retry: {
    maxAttempts: 3,
    delay: 1000,
    backoff: 2
  }
});
```

### 自定义验证

```typescript
const validatedNode = new ActionNode({
  key: 'validated-action',
  expectedType: 'object',
  instruction: '执行需要验证的操作',
  example: { success: true, data: {} },
  validator: async (result) => {
    // 自定义验证逻辑
    return result.success && result.data && Object.keys(result.data).length > 0;
  }
});
```

### 结果缓存

```typescript
const cachedNode = new ActionNode({
  key: 'expensive-operation',
  expectedType: 'object',
  instruction: '执行耗时操作',
  example: { result: 'computed value' },
  enableCache: true  // 启用缓存
});
```

## 监控和调试

### 执行统计

```typescript
// 获取编排器摘要
const summary = orchestrator.getSummary();
console.log('工作流状态:', summary);

// 获取执行历史
const history = orchestrator.getExecutionHistory();
console.log('执行历史:', history);
```

### 可视化

```typescript
// 生成 DOT 格式的工作流图
const dotGraph = orchestrator.toDOT();
console.log('工作流图:', dotGraph);
```

### 节点状态

```typescript
// 获取节点摘要
const nodeSummary = actionNode.getSummary();
console.log('节点状态:', nodeSummary);

// 检查依赖关系
const dependencies = actionNode.getDependencies();
const dependents = actionNode.getDependents();
```

## 最佳实践

### 1. 节点设计原则

- **单一职责**：每个节点应该只负责一个明确的任务
- **幂等性**：节点应该支持重复执行而不产生副作用
- **错误处理**：提供适当的错误处理和回滚机制
- **类型安全**：充分利用 TypeScript 的类型系统

### 2. 依赖管理

- **避免循环依赖**：使用 `hasCircularDependencies()` 检查
- **最小化依赖**：只添加必要的依赖关系
- **清晰的数据流**：确保依赖关系反映真实的数据流向

### 3. 性能优化

- **合理使用缓存**：对于计算密集型操作启用缓存
- **并发控制**：根据系统资源设置合适的并发数
- **超时设置**：为长时间运行的操作设置超时

### 4. 错误处理

- **优雅降级**：使用 `continueOnError` 实现优雅降级
- **自动重试**：为临时性错误配置重试机制
- **回滚策略**：为有副作用的操作提供回滚函数

## 测试

系统包含完整的测试套件：

- **ActionNode 测试**：25个测试用例，覆盖所有核心功能
- **ActionOrchestrator 测试**：28个测试用例，覆盖编排逻辑
- **集成测试**：完整的工作流测试和示例

运行测试：

```bash
bun test --run actions/__tests__/
```

## 示例

查看 `examples/action-orchestration-example.ts` 获取完整的使用示例：

- 软件开发工作流
- 并行数据处理
- 错误处理和回滚

## 技术特色

### 相比 Python 版本的优势

1. **类型安全**：完整的 TypeScript 类型支持，编译时错误检查
2. **内存安全**：使用 WeakMap 管理元数据，避免内存泄漏
3. **异步优化**：原生 Promise/async-await 支持
4. **装饰器模式**：更符合 TypeScript 规范的装饰器设计
5. **IDE 支持**：更好的代码提示和重构支持

### 架构设计

- **模块化设计**：清晰的模块边界和接口定义
- **可扩展性**：支持自定义节点类型和执行策略
- **可测试性**：完整的测试覆盖和模拟支持
- **可维护性**：清晰的代码结构和文档

## 未来规划

- [ ] 可视化编辑器：图形化的工作流编辑界面
- [ ] 动态工作流：运行时修改工作流结构
- [ ] 分布式执行：跨节点的工作流执行
- [ ] 工作流模板：预定义的常用工作流模板
- [ ] 性能分析：更详细的性能分析和优化建议

## 贡献

欢迎提交 Issue 和 Pull Request 来改进动作编排系统。请确保：

1. 遵循现有的代码风格
2. 添加适当的测试用例
3. 更新相关文档
4. 通过所有测试检查
