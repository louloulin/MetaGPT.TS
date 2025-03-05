import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { DependencyManager } from './dependency-manager';
import type { 
  DependencyAnalysisResult, 
  DependencyInstallResult,
  DependencyManagerConfig 
} from './dependency-manager';

const execAsync = promisify(exec);

/**
 * Python依赖管理器配置
 */
export interface PythonDependencyManagerConfig extends DependencyManagerConfig {
  // pip命令路径
  pipCommand?: string;
  // 是否使用user模式安装
  userInstall?: boolean;
  // 是否使用requirements.txt
  useRequirements?: boolean;
  // requirements.txt路径
  requirementsPath?: string;
  // 额外pip参数
  pipExtraArgs?: string[];
}

/**
 * Python依赖管理器
 * 处理Python代码的依赖管理
 */
export class PythonDependencyManager extends DependencyManager {
  protected config: PythonDependencyManagerConfig;
  
  /**
   * 构造函数
   * @param config 配置
   */
  constructor(config: PythonDependencyManagerConfig = {}) {
    super('python', config);
    this.config = {
      pipCommand: 'pip',
      userInstall: true,
      useRequirements: false,
      pipExtraArgs: [],
      ...config
    } as PythonDependencyManagerConfig;
  }
  
  /**
   * 从Python代码中提取依赖
   * @param code Python代码
   */
  async extractDependencies(code: string): Promise<string[]> {
    // 使用正则表达式匹配import语句
    const importRegex = /^(?:from\s+([a-zA-Z0-9_.-]+)|import\s+([a-zA-Z0-9_.-]+))/gm;
    const matches = [...code.matchAll(importRegex)];
    
    // 提取包名
    const packages = matches.map(match => {
      // 优先使用from语句中的包名，如果没有则使用import语句中的包名
      const packageName = match[1] || match[2];
      // 只保留顶级包名
      return packageName.split('.')[0];
    });
    
    // 移除Python内置模块和重复项
    const builtinModules = [
      'os', 'sys', 'time', 'datetime', 'math', 're', 'random',
      'json', 'collections', 'functools', 'itertools', 'typing'
    ];
    
    const filteredPackages = [...new Set(packages)].filter(
      pkg => !builtinModules.includes(pkg)
    );
    
    // 标准化包名 (例如: sklearn -> scikit-learn)
    const packageMapping: Record<string, string> = {
      'sklearn': 'scikit-learn',
      'PIL': 'pillow',
      'cv2': 'opencv-python',
      'yaml': 'pyyaml',
      'bs4': 'beautifulsoup4',
      'wx': 'wxpython',
      'tk': 'tkinter',
      'dotenv': 'python-dotenv'
    };
    
    const normalizedPackages = filteredPackages.map(
      pkg => packageMapping[pkg] || pkg
    );
    
    logger.info(`[PythonDependencyManager] Extracted dependencies:`, normalizedPackages);
    return normalizedPackages;
  }
  
  /**
   * 检查Python依赖是否已安装
   * @param dependencies 依赖列表
   */
  async checkDependencies(dependencies: string[]): Promise<DependencyAnalysisResult> {
    logger.info(`[PythonDependencyManager] Checking dependencies:`, dependencies);
    
    const result: DependencyAnalysisResult = {
      missingDependencies: [],
      installedDependencies: [],
      unknownDependencies: [],
      success: true
    };
    
    // 准备Python环境
    let pythonPath = 'python';
    
    if (this.config.useVirtualEnv && this.config.virtualEnvPath) {
      // 使用虚拟环境
      const activateScript = process.platform === 'win32' 
        ? path.join(this.config.virtualEnvPath, 'Scripts', 'activate.bat')
        : path.join(this.config.virtualEnvPath, 'bin', 'activate');
        
      logger.info(`[PythonDependencyManager] Using virtual environment: ${activateScript}`);
      pythonPath = process.platform === 'win32'
        ? path.join(this.config.virtualEnvPath, 'Scripts', 'python.exe')
        : path.join(this.config.virtualEnvPath, 'bin', 'python');
    }
    
    // 检查每个依赖
    for (const dependency of dependencies) {
      try {
        const importName = dependency
          .replace('scikit-learn', 'sklearn')
          .replace('-', '_')
          .replace('python-dotenv', 'dotenv')
          .replace('pillow', 'PIL');
          
        const command = `${pythonPath} -c "import ${importName}"`;
        await execAsync(command, { timeout: 10000 });
        
        // 如果没有报错，则依赖已安装
        result.installedDependencies.push(dependency);
      } catch (error) {
        const typedError = error as any;
        
        if (typedError.code === 'ENOENT') {
          // Python解释器未找到
          logger.error(`[PythonDependencyManager] Python interpreter not found:`, typedError);
          result.success = false;
          result.error = new Error(`Python interpreter not found: ${pythonPath}`);
          break;
        } else if (typedError.killed && typedError.signal === 'SIGTERM') {
          // 超时
          logger.warn(`[PythonDependencyManager] Dependency check timed out for: ${dependency}`);
          result.unknownDependencies.push(dependency);
        } else {
          // 其他错误，假设是依赖未安装
          logger.info(`[PythonDependencyManager] Dependency not installed: ${dependency}`);
          result.missingDependencies.push(dependency);
        }
      }
    }
    
    return result;
  }
  
  /**
   * 安装Python依赖
   * @param dependencies 依赖列表
   */
  async installDependencies(dependencies: string[]): Promise<DependencyInstallResult> {
    logger.info(`[PythonDependencyManager] Installing dependencies:`, dependencies);
    
    // 初始化安装结果
    const result: DependencyInstallResult = {
      success: false,
      installed: [],
      failed: [],
      log: ''
    };
    
    // 如果没有依赖需要安装，直接返回成功
    if (dependencies.length === 0) {
      result.success = true;
      result.log = 'No dependencies to install';
      return result;
    }
    
    // 准备pip命令
    let pipCmd = this.config.pipCommand || 'pip';
    
    if (this.config.useVirtualEnv && this.config.virtualEnvPath) {
      // 使用虚拟环境中的pip
      pipCmd = process.platform === 'win32'
        ? path.join(this.config.virtualEnvPath, 'Scripts', 'pip.exe')
        : path.join(this.config.virtualEnvPath, 'bin', 'pip');
    }
    
    // 准备安装命令
    const args: string[] = ['install'];
    
    // 使用user模式
    if (this.config.userInstall) {
      args.push('--user');
    }
    
    // 使用代理
    if (this.config.useProxy && this.config.proxyUrl) {
      args.push('--proxy', this.config.proxyUrl);
    }
    
    // 使用自定义镜像源
    if (this.config.customRegistry) {
      args.push('-i', this.config.customRegistry);
    }
    
    // 添加额外参数
    if (this.config.pipExtraArgs && this.config.pipExtraArgs.length > 0) {
      args.push(...this.config.pipExtraArgs);
    }
    
    // 添加依赖
    args.push(...dependencies);
    
    const command = `${pipCmd} ${args.join(' ')}`;
    logger.info(`[PythonDependencyManager] Install command: ${command}`);
    
    try {
      // 执行安装命令
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config.installTimeout || 300000,
        cwd: this.config.workDir
      });
      
      // 解析输出判断成功安装的依赖
      result.log = `${stdout}\n${stderr}`;
      
      if (stderr && stderr.includes('ERROR')) {
        // 有安装错误
        result.success = false;
        // 尝试从错误输出中解析失败的依赖
        dependencies.forEach(dep => {
          if (stderr.includes(`Could not find a version that satisfies the requirement ${dep}`)) {
            result.failed.push(dep);
          } else {
            // 假设其他依赖安装成功
            result.installed.push(dep);
          }
        });
      } else {
        // 所有依赖安装成功
        result.success = true;
        result.installed = [...dependencies];
      }
      
      logger.info(`[PythonDependencyManager] Installation completed: ${result.success ? 'Success' : 'Failed'}`);
      logger.debug(`[PythonDependencyManager] Installation log: ${result.log}`);
    } catch (error) {
      const typedError = error as any;
      result.success = false;
      result.error = new Error(typedError.message || 'Unknown installation error');
      result.log = typedError.stdout || '' + '\n' + typedError.stderr || '';
      
      // 所有依赖安装失败
      result.failed = [...dependencies];
      
      logger.error(`[PythonDependencyManager] Installation error:`, typedError);
    }
    
    return result;
  }
  
  /**
   * 创建一键安装脚本
   * @param dependencies 依赖列表
   */
  createInstallScript(dependencies: string[]): string {
    if (dependencies.length === 0) {
      return '';
    }
    
    const pipCmd = this.config.pipCommand || 'pip';
    const args = ['install'];
    
    if (this.config.userInstall) {
      args.push('--user');
    }
    
    if (this.config.customRegistry) {
      args.push('-i', this.config.customRegistry);
    }
    
    args.push(...dependencies);
    
    return `${pipCmd} ${args.join(' ')}`;
  }
} 