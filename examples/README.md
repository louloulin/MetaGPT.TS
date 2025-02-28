# MetaGPT TypeScript 角色示例

本目录包含了 MetaGPT TypeScript 版本中所有角色的示例代码。

## 可用角色

1. Teacher (教师) - `teacher_example.ts`
   - 创建课程计划
   - 解释概念
   - 生成测验题
   - 评估学生答案

2. Assistant (助手) - `assistant_example.ts`
   - 回答问题
   - 提供建议
   - 执行任务

3. Researcher (研究员) - `researcher_example.ts`
   - 收集信息
   - 分析数据
   - 生成报告

4. CustomerService (客服) - `customer_service_example.ts`
   - 处理客户询问
   - 解决问题
   - 收集反馈

5. Searcher (搜索者) - `searcher_example.ts`
   - 执行搜索
   - 过滤结果
   - 提供摘要

6. TutorialAssistant (教程助手) - `tutorial_assistant_example.ts`
   - 创建教程
   - 提供指导
   - 回答问题

7. Sales (销售) - `sales_example.ts`
   - 产品推介
   - 需求分析
   - 销售跟进

8. ProjectManager (项目经理) - `project_manager_example.ts`
   - 项目规划
   - 任务分配
   - 进度跟踪

9. QAEngineer (质量工程师) - `qa_engineer_example.ts`
   - 测试计划
   - 执行测试
   - 报告问题

10. ProductManager (产品经理) - `product_manager_example.ts`
    - 需求收集
    - 产品规划
    - 特性定义

11. DataInterpreter (数据解释器) - `data_interpreter_example.ts`
    - 数据分析
    - 图表生成
    - 结果解释

12. Engineer (工程师) - `engineer_example.ts`
    - 代码实现
    - 问题解决
    - 技术评估

13. Architect (架构师) - `architect_example.ts`
    - 系统设计
    - 架构评审
    - 技术选型

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

3. 运行特定角色的示例：

```bash
bun run examples/roles/<role_example>.ts
```

### 注意事项

1. 确保你的 API Key 有足够的配额
2. 建议在开发环境中使用较小的 max_tokens 值来节省配额
3. 如果遇到超时问题，可以适当增加 timeout 值
4. 每个角色都有其特定的系统提示词，可以根据需要调整 