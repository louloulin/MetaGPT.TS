import { DataInterpreter, RunMode } from '../src/roles/data-interpreter';
import { logger, LogLevel } from '../src/utils/logger';
import type { SupportedLanguage } from '../src/actions/dependency-manager/dependency-manager-factory';
import type { DependencyManagerConfig } from '../src/actions/dependency-manager/dependency-manager';
import type { LLMProvider } from '../src/types/llm';
import type { Message } from '../src/types/message';
import { v4 as uuidv4 } from 'uuid';
// 导入ExecuteNbCode类
import { ExecuteNbCode } from '../src/actions/di/execute-nb-code';

// 设置日志级别
logger.setLevel(LogLevel.INFO);

/**
 * 运行配置
 */
interface RunConfig {
  /** 使用任务拆解 */
  usePlan: boolean;
  /** 运行模式 */
  runMode: 'regular' | 'streaming';
  /** 使用反思 */
  useReflection: boolean;
  /** 最大迭代次数 */
  maxIterations: number;
  /** 依赖管理 */
  dependencyManagement: {
    /** 是否启用依赖管理 */
    enabled: boolean;
    /** 是否自动安装缺失依赖 */
    autoInstall: boolean;
    /** 指定语言，默认为自动检测 */
    language?: SupportedLanguage;
  };
  /** 代码执行 */
  codeExecution: {
    /** 项目名称前缀 */
    projectPrefix: string;
    /** 是否保留工作目录 */
    preserveFiles: boolean;
    /** 基础工作目录 */
    baseDir?: string;
    /** 是否设置pip3到pip的软连接 */
    setupPipLink?: boolean;
  };
}

/**
 * 创建一个消息对象
 * @param content 消息内容
 */
function createMessage(content: string): Message {
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
 * 扩展DataInterpreter类，提供简化的分析方法
 */
class EnhancedDataInterpreter extends DataInterpreter {
  private codeExecutor: ExecuteNbCode;
  
  constructor(config: any, llmProvider: LLMProvider) {
    super(config);
    
    // 初始化代码执行器
    this.codeExecutor = new ExecuteNbCode(llmProvider, {
      projectPrefix: config.codeExecution?.projectPrefix || '数据服务',
      preserveFiles: config.codeExecution?.preserveFiles !== false,
      baseDir: config.codeExecution?.baseDir || 'workspace',
      setupPipLink: config.codeExecution?.setupPipLink !== false
    });
    
    logger.info(`[EnhancedDataInterpreter] 初始化代码执行器，项目前缀: ${config.codeExecution?.projectPrefix || '数据服务'}`);
    logger.info(`[EnhancedDataInterpreter] 工作目录: ${config.codeExecution?.baseDir || 'workspace'}`);
    logger.info(`[EnhancedDataInterpreter] 设置pip软连接: ${config.codeExecution?.setupPipLink !== false ? '是' : '否'}`);
  }
  
  /**
   * 常规分析方法
   * @param requirement 分析需求
   */
  async analyze(requirement: string): Promise<string> {
    const message = createMessage(requirement);
    const result = await this.run(message);
    return result.content;
  }

  /**
   * 流式分析方法
   * @param requirement 分析需求
   * @param callback 流式回调函数
   */
  async streamAnalyze(requirement: string, callback: (chunk: string, section: string) => void): Promise<string> {
    const message = createMessage(requirement);
    const result = await this.run(message, {
      mode: RunMode.STREAMING,
      streamCallback: callback
    });
    return result.content;
  }
  
  /**
   * 直接执行代码
   * @param code 要执行的代码
   * @returns [结果, 是否成功]
   */
  async executeCode(code: string): Promise<[string, boolean]> {
    return await this.codeExecutor.run(code);
  }
  
  /**
   * 获取当前工作目录
   */
  getCurrentWorkspace(): string {
    return this.codeExecutor.getCurrentWorkspace();
  }
  
  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await super.cleanup();
    if (this.codeExecutor) {
      await this.codeExecutor.terminate();
    }
  }
}

/**
 * 加载配置
 * 在实际环境中，这些通常来自环境变量
 */
function loadConfig(): RunConfig {
  return {
    usePlan: true,
    runMode: 'regular',
    useReflection: false,
    maxIterations: 5,
    dependencyManagement: {
      enabled: true,
      autoInstall: true,
      // 不指定语言，让系统自动检测
    },
    codeExecution: {
      projectPrefix: '数据服务',    // 设置项目名称前缀
      preserveFiles: true,          // 保留工作目录以便分析
      baseDir: 'workspace',         // 基础工作目录
      setupPipLink: true            // 设置pip3到pip的软连接
    }
  };
}

/**
 * 数据解释器示例
 */
async function main() {
  try {
    // 加载配置
    const runConfig = loadConfig();
    
    logger.info('运行配置:', {
      usePlan: runConfig.usePlan,
      runMode: runConfig.runMode,
      useReflection: runConfig.useReflection,
      maxIterations: runConfig.maxIterations,
      dependencyManagement: {
        enabled: runConfig.dependencyManagement.enabled,
        autoInstall: runConfig.dependencyManagement.autoInstall,
        language: runConfig.dependencyManagement.language || '自动检测',
      },
      codeExecution: {
        projectPrefix: runConfig.codeExecution.projectPrefix,
        preserveFiles: runConfig.codeExecution.preserveFiles,
        baseDir: runConfig.codeExecution.baseDir || 'workspace',
        setupPipLink: runConfig.codeExecution.setupPipLink !== false
      }
    });
    
    // 模拟LLM提供者
    // 实际使用时应替换为真实的LLM提供者
    const llmProvider: LLMProvider = {
      chat: async (message: string): Promise<string> => "LLM聊天模拟响应",
      generate: async (prompt: string): Promise<string> => "LLM生成模拟响应",
      getName: () => "Mock LLM Provider",
      getModel: () => "Mock Model"
    };
    
    // 创建数据解释器实例
    const interpreter = new EnhancedDataInterpreter({
      llm: llmProvider,
      auto_run: true,
      use_plan: runConfig.usePlan,
      use_reflection: runConfig.useReflection,
      react_mode: runConfig.usePlan ? 'plan_and_act' : 'react',
      max_react_loop: runConfig.maxIterations,
      outputDir: './output',
      dependencyManagement: {
        enabled: runConfig.dependencyManagement.enabled,
        autoInstall: runConfig.dependencyManagement.autoInstall,
        language: runConfig.dependencyManagement.language,
        config: {
          // 基本配置
          workDir: './output',
          userInstall: true
        } as DependencyManagerConfig
      },
      codeExecution: {
        projectPrefix: runConfig.codeExecution.projectPrefix,
        preserveFiles: runConfig.codeExecution.preserveFiles,
        baseDir: runConfig.codeExecution.baseDir,
        setupPipLink: runConfig.codeExecution.setupPipLink
      }
    }, llmProvider);
    
    // 直接执行代码示例
    logger.info('直接执行代码示例');
    const testCode = `
import matplotlib.pyplot as plt
import numpy as np

# 创建数据
years = [2020, 2021, 2022, 2023]
sales = [100, 150, 200, 250]

# 绘制柱状图
plt.figure(figsize=(10, 6))
plt.bar(years, sales, color='skyblue')
plt.title('年度销售额')
plt.xlabel('年份')
plt.ylabel('销售额')
plt.grid(axis='y', linestyle='--', alpha=0.7)

# 在柱子上添加数值标签
for i, v in enumerate(sales):
    plt.text(years[i], v + 5, str(v), ha='center')

# 显示图表
plt.tight_layout()
plt.savefig('sales_chart.png')  # 保存图表
print("柱状图已生成并保存为sales_chart.png")
`;

    const [testResult, testSuccess] = await interpreter.executeCode(testCode);
    if (testSuccess) {
      logger.info('代码执行成功:', testResult);
      const workspacePath = interpreter.getCurrentWorkspace();
      logger.info(`工作目录路径: ${workspacePath}`);
      logger.info('生成的文件包括main.py, README.md, output.txt和图片文件');
    } else {
      logger.error('代码执行失败:', testResult);
      const workspacePath = interpreter.getCurrentWorkspace();
      logger.error(`错误详情请查看工作目录: ${workspacePath}`);
    }
    
    // 用户需求
    const requirement = `
      分析以下数据并绘制柱状图：
      年份, 销售额
      2020, 100
      2021, 150
      2022, 200
      2023, 250
    `;
    
    try {
      // 根据运行模式执行分析
      if (runConfig.runMode === 'streaming') {
        let result = '';
        
        // 流式执行，实时获取输出
        await interpreter.streamAnalyze(
          requirement,
          (chunk: string, section: string) => {
            logger.info(`[${section}] ${chunk}`);
            result += chunk;
          }
        );
        
        logger.info('分析完成，结果：', result);
      } else {
        // 常规执行，等待完整结果
        const result = await interpreter.analyze(requirement);
        logger.info('分析完成，结果：', result);
      }
    } catch (error) {
      logger.error('执行出错：', error);
    } finally {
      // 清理资源
      await interpreter.cleanup();
    }
    
    // 使用说明
    logger.info('\n--- 多语言依赖管理功能展示 ---');
    logger.info('本示例展示了MetaGPT-TS的自动依赖管理功能:');
    logger.info('1. 自动检测代码语言（Python/Node.js）');
    logger.info('2. 提取代码中的依赖项');
    logger.info('3. 检查依赖是否已安装');
    logger.info('4. 自动安装缺失的依赖');
    logger.info('5. 自动设置pip3到pip的软连接');
    logger.info('\n配置选项包括:');
    logger.info('- enabled: 是否启用依赖管理');
    logger.info('- autoInstall: 是否自动安装缺失依赖');
    logger.info('- language: 显式指定语言（python/nodejs），或自动检测');
    logger.info('- projectPrefix: 工作目录前缀，用于标识项目');
    logger.info('- preserveFiles: 是否保留工作目录，便于分析问题');
    logger.info('- baseDir: 基础工作目录，所有项目目录将在此目录下创建');
    logger.info('- setupPipLink: 是否设置pip3到pip的软连接');
    logger.info('\n工作目录结构:');
    logger.info('workspace/');
    logger.info('├── 数据服务-20231101120530/');
    logger.info('│   ├── main.py             # 主代码文件');
    logger.info('│   ├── README.md           # 任务描述和说明');
    logger.info('│   ├── output.txt          # 执行输出（成功时）');
    logger.info('│   ├── error.txt           # 错误信息（失败时）');
    logger.info('│   ├── warnings.log        # 警告信息');
    logger.info('│   ├── requirements.txt    # 依赖项列表');
    logger.info('│   └── *.png, *.csv等      # 生成的数据文件');
  } catch (error) {
    logger.error('程序出错：', error);
  }
}

// 执行示例
main(); 