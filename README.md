# MetaGPT TypeScript

MetaGPT 的 TypeScript 实现，包含核心功能和 UI 组件。

## 项目结构

```
metagpt-ts/
├── packages/
│   ├── core/           # 核心功能实现
│   │   ├── src/
│   │   └── package.json
│   └── ui/            # UI 组件库
│       ├── src/
│       └── package.json
├── package.json
└── turbo.json
```

## 开发

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建

```bash
pnpm build
```

### 测试

```bash
pnpm test
```

### 代码检查

```bash
pnpm lint
```

## 包说明

### @metagpt/core

核心功能实现，包括：

- 角色系统
- 工作流
- 记忆系统
- 知识管理
- 多模态支持
- RAG 实现
- 工具集成
- 等等

### @metagpt/ui

UI 组件库，包括：

- 基础组件
- 布局组件
- 表单组件
- 数据展示组件
- 反馈组件
- 等等

## 许可证

MIT


