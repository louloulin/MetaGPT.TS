/**
 * Virtual Environment Example
 * 
 * This example demonstrates how to use the virtual environment support
 * for data analysis tasks with the EnhancedDataInterpreter.
 */

import { DataInterpreter, RunMode } from '../../src/roles/data-interpreter';
import { logger, LogLevel } from '../../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

// Set log level
logger.setLevel(LogLevel.DEBUG); // 使用DEBUG级别查看更多日志信息

/**
 * Create a message object
 */
function createMessage(content: string) {
  return {
    id: uuidv4(),
    content,
    role: 'user',
    causedBy: 'user',
    sentFrom: 'user',
    timestamp: new Date().toISOString(),
    sendTo: new Set(['*']),
    instructContent: null,
  };
}

/**
 * 创建模拟LLM提供者
 */
function createLLMProvider() {
  // 模拟LLM响应
  const chatResponse = `我将分析需要哪些库来构建简单的机器学习模型，并安装这些依赖在一个虚拟环境中。

首先，让我确认一下需要哪些库:

1. NumPy - 用于数值计算
2. pandas - 用于数据处理
3. matplotlib - 用于数据可视化
4. scikit-learn - 用于机器学习算法

以下是Python代码:

\`\`\`python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

# 加载Iris数据集
iris = load_iris()
X, y = iris.data, iris.target

# 查看数据集信息
print("数据集形状:", X.shape)
print("类别分布:", np.bincount(y))

# 分割训练集和测试集
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 训练随机森林模型
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# 预测
y_pred = clf.predict(X_test)

# 评估模型
accuracy = accuracy_score(y_test, y_pred)
print(f"模型准确率: {accuracy:.4f}")
print("\\n分类报告:")
print(classification_report(y_test, y_pred, target_names=iris.target_names))

# 可视化特征重要性
plt.figure(figsize=(10, 6))
features = iris.feature_names
importances = clf.feature_importances_
indices = np.argsort(importances)

plt.title('Iris数据集中特征的重要性')
plt.barh(range(len(indices)), importances[indices], color='b', align='center')
plt.yticks(range(len(indices)), [features[i] for i in indices])
plt.xlabel('相对重要性')
plt.savefig('feature_importance.png')
plt.close()

print("\\n分析完成! 特征重要性图已保存为'feature_importance.png'")
\`\`\`

这段代码将加载Iris数据集，训练一个随机森林分类器，并评估模型性能。还会生成一个特征重要性的可视化图表。`;

  // 模拟LLM提供者
  return {
    chat: async () => ({
      content: chatResponse
    }),
    generate: async () => ({
      content: chatResponse
    })
  };
}

/**
 * 保存结果到文件
 */
async function saveResults(response: string, filename: string): Promise<void> {
  try {
    await fs.writeFile(filename, response);
    console.log(`结果已保存到: ${filename}`);
  } catch (error) {
    console.error('保存结果时出错:', error);
  }
}

/**
 * Enhanced DataInterpreter wrapper for simpler usage
 */
class EnhancedDataInterpreter extends DataInterpreter {
  constructor(config: any, llmProvider: any) {
    super(config);
    
    // 重新配置提供者（默认已配置）
    if (llmProvider) {
      this.setLLMProvider(llmProvider);
    }
  }
  
  /**
   * 设置LLM提供者
   */
  private setLLMProvider(llmProvider: any): void {
    // @ts-ignore - 我们知道这个属性存在于DataInterpreter中
    this.provider = llmProvider;
  }
  
  /**
   * 分析方法
   */
  async analyze(requirement: string): Promise<string> {
    const message = createMessage(requirement);
    const result = await this.run(message);
    return result.content;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('开始虚拟环境支持示例...');
  
  // 配置数据解释器
  const config = {
    runMode: 'parallel',
    codeExecution: {
      projectPrefix: '虚拟环境测试',
      preserveFiles: true,
      baseDir: 'workspace',
      checkDependencies: true,
      autoInstallDependencies: true,  // 启用自动安装依赖
      skipDependenciesErrors: false,  // 不跳过依赖错误
      useVirtualEnv: true,            // 启用虚拟环境支持
      preInstallCommonDeps: true      // 启用预安装公共依赖
    }
  };
  
  // 创建LLM提供者和数据解释器
  const llmProvider = createLLMProvider();
  const interpreter = new EnhancedDataInterpreter(config, llmProvider);
  
  // 运行分析
  console.log('正在运行数据分析...');
  const requirement = '帮我使用Python训练一个简单的机器学习模型，使用Iris数据集，并分析特征重要性';
  
  try {
    const response = await interpreter.analyze(requirement);
    console.log('分析完成!');
    console.log('-'.repeat(40));
    console.log(response);
    console.log('-'.repeat(40));
    
    // 保存结果
    await saveResults(response, 'virtual_env_result.md');
  } catch (error) {
    console.error('运行分析时出错:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
} 