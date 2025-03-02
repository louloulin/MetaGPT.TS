import { logger } from '../../utils/logger';

/**
 * 依赖分析结果
 */
export interface DependencyAnalysisResult {
  // 缺失的依赖
  missingDependencies: string[];
  // 已安装的依赖
  installedDependencies: string[];
  // 未知状态的依赖
  unknownDependencies: string[];
  // 分析是否成功
  success: boolean;
  // 错误信息
  error?: Error;
  // 分析详情
  details?: Record<string, any>;
}

/**
 * 依赖安装结果
 */
export interface DependencyInstallResult {
  // 安装是否成功
  success: boolean;
  // 成功安装的依赖
  installed: string[];
  // 安装失败的依赖
  failed: string[];
  // 完整的安装日志
  log: string;
  // 错误信息
  error?: Error;
}

/**
 * 依赖管理器配置
 */
export interface DependencyManagerConfig {
  // 自动安装依赖
  autoInstall?: boolean;
  // 依赖安装超时时间(毫秒)
  installTimeout?: number;
  // 是否使用代理
  useProxy?: boolean;
  // 代理URL
  proxyUrl?: string;
  // 自定义依赖源
  customRegistry?: string;
  // 工作目录
  workDir?: string;
  // 是否使用虚拟环境
  useVirtualEnv?: boolean;
  // 虚拟环境路径
  virtualEnvPath?: string;
  // 额外参数
  extraOptions?: Record<string, any>;
}

/**
 * 抽象依赖管理器接口
 * 为不同语言环境提供统一的依赖管理能力
 */
export abstract class DependencyManager {
  // 语言类型
  protected language: string;
  // 配置
  protected config: DependencyManagerConfig;
  
  /**
   * 构造函数
   * @param language 语言类型
   * @param config 配置
   */
  constructor(language: string, config: DependencyManagerConfig = {}) {
    this.language = language;
    this.config = {
      autoInstall: true,
      installTimeout: 300000, // 5分钟
      useProxy: false,
      workDir: process.cwd(),
      useVirtualEnv: false,
      ...config
    };
    
    logger.info(`[DependencyManager:${this.language}] Initialized with config:`, {
      autoInstall: this.config.autoInstall,
      workDir: this.config.workDir,
      useVirtualEnv: this.config.useVirtualEnv,
      useProxy: this.config.useProxy
    });
  }
  
  /**
   * 从代码中提取依赖
   * @param code 代码内容
   */
  abstract extractDependencies(code: string): Promise<string[]>;
  
  /**
   * 检查依赖是否已安装
   * @param dependencies 依赖列表
   */
  abstract checkDependencies(dependencies: string[]): Promise<DependencyAnalysisResult>;
  
  /**
   * 安装依赖
   * @param dependencies 依赖列表
   */
  abstract installDependencies(dependencies: string[]): Promise<DependencyInstallResult>;
  
  /**
   * 处理代码，检查并安装依赖
   * @param code 代码内容
   */
  async process(code: string): Promise<{
    success: boolean;
    code: string;
    log: string;
    error?: Error;
  }> {
    try {
      logger.info(`[DependencyManager:${this.language}] Processing code...`);
      
      // 1. 提取依赖
      const dependencies = await this.extractDependencies(code);
      logger.info(`[DependencyManager:${this.language}] Extracted ${dependencies.length} dependencies`);
      
      if (dependencies.length === 0) {
        return { 
          success: true, 
          code, 
          log: `No dependencies found for ${this.language}` 
        };
      }
      
      // 2. 检查依赖
      const analysisResult = await this.checkDependencies(dependencies);
      logger.info(`[DependencyManager:${this.language}] Dependency analysis result:`, {
        missing: analysisResult.missingDependencies.length,
        installed: analysisResult.installedDependencies.length,
        unknown: analysisResult.unknownDependencies.length
      });
      
      // 如果所有依赖都已安装，直接返回
      if (analysisResult.missingDependencies.length === 0 && 
          analysisResult.unknownDependencies.length === 0) {
        return {
          success: true,
          code,
          log: `All ${this.language} dependencies are installed`
        };
      }
      
      // 3. 如果有缺失依赖且启用了自动安装，则安装依赖
      let installResult: DependencyInstallResult = {
        success: false,
        installed: [],
        failed: [],
        log: ''
      };
      
      if (this.config.autoInstall) {
        const dependenciesToInstall = [
          ...analysisResult.missingDependencies,
          ...analysisResult.unknownDependencies
        ];
        
        if (dependenciesToInstall.length > 0) {
          logger.info(`[DependencyManager:${this.language}] Installing ${dependenciesToInstall.length} dependencies...`);
          installResult = await this.installDependencies(dependenciesToInstall);
          
          logger.info(`[DependencyManager:${this.language}] Installation result:`, {
            success: installResult.success,
            installed: installResult.installed.length,
            failed: installResult.failed.length
          });
        }
      } else {
        installResult.log = `Auto-install disabled, skipping installation of ${analysisResult.missingDependencies.length} missing dependencies`;
        logger.warn(`[DependencyManager:${this.language}] ${installResult.log}`);
      }
      
      // 4. 如果安装成功或不需要安装，返回原始代码
      if (
        (this.config.autoInstall && installResult.success) || 
        (!this.config.autoInstall)
      ) {
        // 合并安装日志
        const log = `
Dependency analysis:
- Found: ${dependencies.length} dependencies
- Missing: ${analysisResult.missingDependencies.length} dependencies
- Installed: ${analysisResult.installedDependencies.length} dependencies
- Unknown: ${analysisResult.unknownDependencies.length} dependencies

${installResult.log}
        `.trim();
        
        return {
          success: this.config.autoInstall ? installResult.success : true,
          code,
          log
        };
      }
      
      // 5. 如果安装失败，返回错误
      return {
        success: false,
        code,
        log: installResult.log,
        error: installResult.error || new Error(`Failed to install ${this.language} dependencies`)
      };
    } catch (error) {
      const typedError = error as Error;
      logger.error(`[DependencyManager:${this.language}] Error processing code:`, typedError);
      
      return {
        success: false,
        code,
        log: `Error processing ${this.language} dependencies: ${typedError.message}`,
        error: typedError
      };
    }
  }
  
  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    logger.info(`[DependencyManager:${this.language}] Cleaning up resources...`);
    // 子类可以重写此方法以进行特定的清理工作
  }
} 