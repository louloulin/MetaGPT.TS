# MetaGPT TypeScript 示例

本目录包含了 MetaGPT TypeScript 版本的各种示例代码。

## 教师角色示例

`teacher_example.ts` 展示了如何使用 Teacher 角色进行教学互动。这个示例包括：

1. 创建课程计划
2. 解释概念
3. 生成测验题
4. 评估学生答案

### 运行示例

1. 首先确保已安装所有依赖：

```bash
bun install
```

2. 设置环境变量：

```bash
# Windows PowerShell
$env:QWEN_API_KEY="your-api-key-here"
$env:QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

# Linux/Mac
export QWEN_API_KEY="your-api-key-here"
export QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
```

3. 运行示例：

```bash
bun run examples/teacher_example.ts
```

### 配置说明

示例中使用了通义千问的 API，你需要：

1. 注册通义千问开发者账号
2. 获取 API Key
3. 设置环境变量 `QWEN_API_KEY` 和 `QWEN_BASE_URL`

### 自定义配置

你可以通过修改以下参数来自定义 Teacher 的行为：

- `teachingStyle`: 教学风格 ('socratic' | 'direct' | 'interactive' | 'adaptive')
- `subjectExpertise`: 专业领域 (字符串数组)
- `difficultyLevels`: 难度等级 ('beginner' | 'intermediate' | 'advanced')

### 注意事项

1. 确保你的 API Key 有足够的配额
2. 建议在开发环境中使用较小的 max_tokens 值来节省配额
3. 如果遇到超时问题，可以适当增加 timeout 值 