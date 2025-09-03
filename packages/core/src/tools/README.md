# 工具系统 (Tool System)

MetaGPT.TS 的增强工具系统，提供类型安全的工具管理和执行框架。

## 🚀 特性

- **类型安全**：充分利用 TypeScript 高级类型特性
- **状态管理**：集成状态机管理工具生命周期
- **事件驱动**：完整的事件系统支持监控和扩展
- **性能监控**：内置指标收集和性能分析
- **可扩展性**：插件化架构支持自定义工具
- **错误处理**：完善的错误处理和恢复机制

## 📦 核心组件

### BaseTool / SimpleBaseTool

工具基类，提供所有工具的基础功能：

```typescript
import { SimpleBaseTool } from '@metagpt/core';

class MyTool extends SimpleBaseTool {
  constructor() {
    super({
      name: 'my_tool',
      description: 'My custom tool',
      version: '1.0.0',
      category: 'custom',
      type: 'custom:my',
      tags: ['custom', 'example'],
    });
  }

  protected async executeInternal(args?: Record<string, any>): Promise<ToolResult> {
    const startTime = new Date();
    
    // 工具逻辑
    const result = await this.doSomething(args);
    
    return this.createResult(true, 'Success', result, {}, startTime);
  }
}
```

### ToolManager

工具管理器，负责工具的注册、发现和执行：

```typescript
import { ToolManager } from '@metagpt/core';

const toolManager = ToolManager.getInstance();

// 注册工具
await toolManager.register(new MyTool());

// 执行工具
const result = await toolManager.executeTool(toolId, { param: 'value' });

// 搜索工具
const tools = toolManager.searchTools('custom');
```

## 🛠️ 内置工具

### SimpleFileSystemTool

简化的文件系统工具：

```typescript
import { SimpleFileSystemTool } from '@metagpt/core';

const fsTool = new SimpleFileSystemTool();

// 获取工具信息
const info = await fsTool.execute({ operation: 'info' });

// 执行测试
const test = await fsTool.execute({ operation: 'test' });
```

### AIAnalysisTool

AI 文本分析工具：

```typescript
import { AIAnalysisTool } from '@metagpt/core';

const aiTool = new AIAnalysisTool();

// 情感分析
const sentiment = await aiTool.execute({
  text: 'This is amazing!',
  analysisType: 'sentiment'
});

// 关键词提取
const keywords = await aiTool.execute({
  text: 'Your text here',
  analysisType: 'keywords'
});

// 文本摘要
const summary = await aiTool.execute({
  text: 'Long text here...',
  analysisType: 'summary'
});
```

### CodeAnalysisTool

代码质量分析工具：

```typescript
import { CodeAnalysisTool } from '@metagpt/core';

const codeTool = new CodeAnalysisTool();

const analysis = await codeTool.execute({
  code: 'function example() { /* code */ }',
  language: 'javascript'
});

console.log(`质量评分: ${analysis.data.quality.score}/100`);
console.log(`圈复杂度: ${analysis.data.metrics.cyclomaticComplexity}`);
```

## 📊 工具类型系统

工具系统使用 TypeScript 的高级类型特性：

```typescript
// 工具类型
type ToolType = 
  | 'system'
  | 'search'
  | 'code'
  | 'analysis'
  | 'ai'
  | `custom:${string}`;

// 工具ID（品牌类型）
type ToolId<T extends string = string> = T & { readonly __brand: 'ToolId' };

// 工具状态
const ToolState = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;
```

## 🔄 工具生命周期

工具支持完整的生命周期管理：

```typescript
// 创建工具
const tool = new MyTool();

// 验证工具
const isValid = await tool.validate();

// 执行工具
const result = await tool.execute(args, options);

// 取消执行
await tool.cancel();

// 重置状态
await tool.reset();

// 清理资源
await tool.dispose();
```

## 📈 性能监控

工具系统内置性能监控：

```typescript
const metrics = tool.getMetrics();

console.log(`执行次数: ${metrics.executionCount}`);
console.log(`成功率: ${(metrics.successRate * 100).toFixed(1)}%`);
console.log(`平均执行时间: ${metrics.averageExecutionTime.toFixed(2)}ms`);
```

## 🎯 事件系统

工具支持事件监听：

```typescript
tool.on('tool:started', (info) => {
  console.log(`工具 ${info.name} 开始执行`);
});

tool.on('tool:completed', (info, result) => {
  console.log(`工具 ${info.name} 执行完成`);
});

tool.on('tool:failed', (info, error) => {
  console.error(`工具 ${info.name} 执行失败:`, error);
});
```

## 🧪 测试

运行工具系统测试：

```bash
# 基础功能测试
bun test src/tools/__tests__/basic-tool.test.ts

# 运行示例
bun run src/tools/examples/tool-system-example.ts
```

## 📚 示例

查看完整示例：

- `examples/tool-system-example.ts` - 完整的工具系统示例
- `__tests__/basic-tool.test.ts` - 基础功能测试

## 🔧 自定义工具开发

### 1. 继承基类

```typescript
class CustomTool extends SimpleBaseTool {
  constructor() {
    super({
      name: 'custom_tool',
      description: 'My custom tool',
      version: '1.0.0',
      category: 'custom',
      type: 'custom:example',
      tags: ['custom'],
    });
  }

  protected async executeInternal(args?: Record<string, any>): Promise<ToolResult> {
    // 实现工具逻辑
  }
}
```

### 2. 注册和使用

```typescript
const toolManager = ToolManager.getInstance();
const customTool = new CustomTool();

await toolManager.register(customTool);
const result = await toolManager.executeTool(customTool.id, args);
```

### 3. 错误处理

```typescript
class CustomTool extends SimpleBaseTool {
  protected async onError(error: Error): Promise<void> {
    // 自定义错误处理
    console.error('Custom tool error:', error);
  }
}
```

## 🎉 总结

工具系统提供了：

- ✅ 类型安全的工具开发框架
- ✅ 完整的工具生命周期管理
- ✅ 内置性能监控和错误处理
- ✅ 事件驱动的扩展机制
- ✅ 丰富的内置工具实现
- ✅ 完整的测试覆盖

这个系统为 MetaGPT.TS 提供了强大而灵活的工具基础设施，支持各种类型的工具开发和集成。
