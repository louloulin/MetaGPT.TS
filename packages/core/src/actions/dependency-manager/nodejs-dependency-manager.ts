import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../../utils/logger';
import { DependencyManager } from './dependency-manager';
import type { 
  DependencyAnalysisResult, 
  DependencyInstallResult,
  DependencyManagerConfig 
} from './dependency-manager';

const execAsync = promisify(exec);

/**
 * Node.js依赖管理器配置
 */
export interface NodejsDependencyManagerConfig extends DependencyManagerConfig {
  // 使用的包管理器: npm, yarn, pnpm
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  // 是否使用精确版本
  exactVersions?: boolean;
  // 是否作为开发依赖安装
  devDependencies?: boolean;
  // 额外命令行参数
  extraArgs?: string[];
}

/**
 * Node.js依赖管理器
 * 处理JavaScript/TypeScript代码的依赖管理
 */
export class NodejsDependencyManager extends DependencyManager {
  protected config: NodejsDependencyManagerConfig;
  
  /**
   * 构造函数
   * @param config 配置
   */
  constructor(config: NodejsDependencyManagerConfig = {}) {
    super('nodejs', config);
    this.config = {
      packageManager: 'npm',
      exactVersions: false,
      devDependencies: false,
      extraArgs: [],
      ...config
    } as NodejsDependencyManagerConfig;
  }
  
  /**
   * 从JS/TS代码中提取依赖
   * @param code JavaScript/TypeScript代码
   */
  async extractDependencies(code: string): Promise<string[]> {
    // 使用正则表达式匹配import和require语句
    const importRegex = /(?:import\s+.*?from\s+['"]([^'"./][^'"]*?)['"]|(?:const|let|var)\s+.*?=\s+require\(['"]([^'"./][^'"]*?)['"]\))/g;
    const matches = [...code.matchAll(importRegex)];
    
    // 提取包名
    const packages = matches.map(match => {
      // 匹配组1是import语句的包名，匹配组2是require语句的包名
      const packagePath = match[1] || match[2];
      // 处理子路径，只保留主包名
      // 例如: import x from 'lodash/isEqual' -> lodash
      return packagePath.split('/')[0];
    });
    
    // 移除Node.js内置模块和重复项
    const builtinModules = [
      'fs', 'path', 'http', 'https', 'util', 'os', 'crypto',
      'process', 'buffer', 'stream', 'zlib', 'events', 'assert',
      'child_process', 'cluster', 'dns', 'net', 'readline',
      'querystring', 'string_decoder', 'tls', 'dgram', 'url',
      'vm', 'worker_threads'
    ];
    
    const filteredPackages = [...new Set(packages)].filter(
      pkg => !builtinModules.includes(pkg)
    );
    
    logger.info(`[NodejsDependencyManager] Extracted dependencies:`, filteredPackages);
    return filteredPackages;
  }
  
  /**
   * 检查Node.js依赖是否已安装
   * @param dependencies 依赖列表
   */
  async checkDependencies(dependencies: string[]): Promise<DependencyAnalysisResult> {
    logger.info(`[NodejsDependencyManager] Checking dependencies:`, dependencies);
    
    const result: DependencyAnalysisResult = {
      missingDependencies: [],
      installedDependencies: [],
      unknownDependencies: [],
      success: true
    };
    
    // 首先检查package.json是否存在
    try {
      const packageJsonPath = path.join(this.config.workDir || process.cwd(), 'package.json');
      const packageJsonExists = await fs.access(packageJsonPath)
        .then(() => true)
        .catch(() => false);
      
      if (!packageJsonExists) {
        logger.warn(`[NodejsDependencyManager] package.json not found at ${packageJsonPath}`);
        // 如果package.json不存在，假设所有依赖都未安装
        result.missingDependencies = [...dependencies];
        return result;
      }
      
      // 读取package.json
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      
      // 检查每个依赖是否在package.json中
      for (const dependency of dependencies) {
        const inDependencies = packageJson.dependencies && dependency in packageJson.dependencies;
        const inDevDependencies = packageJson.devDependencies && dependency in packageJson.devDependencies;
        
        if (inDependencies || inDevDependencies) {
          // 依赖在package.json中，现在检查node_modules
          try {
            // 尝试查找模块的package.json
            const modulePath = path.join(this.config.workDir || process.cwd(), 'node_modules', dependency, 'package.json');
            await fs.access(modulePath);
            
            // 如果没有错误，说明模块确实存在
            result.installedDependencies.push(dependency);
          } catch (error) {
            // 模块在package.json中但不在node_modules中，可能需要安装
            result.missingDependencies.push(dependency);
          }
        } else {
          // 依赖不在package.json中
          result.missingDependencies.push(dependency);
        }
      }
    } catch (error) {
      const typedError = error as Error;
      logger.error(`[NodejsDependencyManager] Error checking dependencies:`, typedError);
      result.success = false;
      result.error = typedError;
      result.missingDependencies = [...dependencies];
    }
    
    return result;
  }
  
  /**
   * 安装Node.js依赖
   * @param dependencies 依赖列表
   */
  async installDependencies(dependencies: string[]): Promise<DependencyInstallResult> {
    logger.info(`[NodejsDependencyManager] Installing dependencies:`, dependencies);
    
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
    
    // 准备安装命令
    const { packageManager } = this.config;
    let installCmd: string;
    const args: string[] = [];
    
    // 根据不同的包管理器配置安装命令
    switch (packageManager) {
      case 'yarn':
        installCmd = 'yarn';
        args.push('add');
        if (this.config.exactVersions) {
          args.push('--exact');
        }
        if (this.config.devDependencies) {
          args.push('--dev');
        }
        break;
        
      case 'pnpm':
        installCmd = 'pnpm';
        args.push('add');
        if (this.config.exactVersions) {
          args.push('--save-exact');
        }
        if (this.config.devDependencies) {
          args.push('--save-dev');
        }
        break;
        
      case 'npm':
      default:
        installCmd = 'npm';
        args.push('install');
        if (this.config.exactVersions) {
          args.push('--save-exact');
        }
        if (this.config.devDependencies) {
          args.push('--save-dev');
        } else {
          args.push('--save');
        }
        break;
    }
    
    // 使用代理
    if (this.config.useProxy && this.config.proxyUrl) {
      switch (packageManager) {
        case 'yarn':
          args.push('--proxy', this.config.proxyUrl);
          break;
        case 'pnpm':
        case 'npm':
        default:
          args.push('--proxy=' + this.config.proxyUrl);
          break;
      }
    }
    
    // 使用自定义镜像源
    if (this.config.customRegistry) {
      switch (packageManager) {
        case 'yarn':
          args.push('--registry', this.config.customRegistry);
          break;
        case 'pnpm':
        case 'npm':
        default:
          args.push('--registry=' + this.config.customRegistry);
          break;
      }
    }
    
    // 添加额外参数
    if (this.config.extraArgs && this.config.extraArgs.length > 0) {
      args.push(...this.config.extraArgs);
    }
    
    // 添加依赖
    args.push(...dependencies);
    
    const command = `${installCmd} ${args.join(' ')}`;
    logger.info(`[NodejsDependencyManager] Install command: ${command}`);
    
    try {
      // 执行安装命令
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config.installTimeout || 300000,
        cwd: this.config.workDir || process.cwd()
      });
      
      // 解析输出日志
      result.log = `${stdout}\n${stderr}`;
      
      // 检查是否有明显的错误
      const hasError = (
        stderr.includes('ERR!') || 
        stderr.includes('ERROR') || 
        stderr.includes('error')
      ) && !stderr.includes('npm WARN');
      
      if (hasError) {
        // 安装有错误
        result.success = false;
        
        // 尝试确定哪些依赖安装失败
        dependencies.forEach(dep => {
          if (
            stderr.includes(`${dep}@`) && 
            (stderr.includes('ERR!') || stderr.includes('Error:'))
          ) {
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
      
      logger.info(`[NodejsDependencyManager] Installation completed: ${result.success ? 'Success' : 'Failed'}`);
    } catch (error) {
      const typedError = error as any;
      result.success = false;
      result.error = new Error(typedError.message || 'Unknown installation error');
      result.log = typedError.stdout || '' + '\n' + typedError.stderr || '';
      
      // 所有依赖安装失败
      result.failed = [...dependencies];
      
      logger.error(`[NodejsDependencyManager] Installation error:`, typedError);
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
    
    const { packageManager } = this.config;
    let installCmd: string;
    const args: string[] = [];
    
    // 根据不同的包管理器配置安装命令
    switch (packageManager) {
      case 'yarn':
        installCmd = 'yarn';
        args.push('add');
        if (this.config.devDependencies) {
          args.push('--dev');
        }
        break;
        
      case 'pnpm':
        installCmd = 'pnpm';
        args.push('add');
        if (this.config.devDependencies) {
          args.push('--save-dev');
        }
        break;
        
      case 'npm':
      default:
        installCmd = 'npm';
        args.push('install');
        if (this.config.devDependencies) {
          args.push('--save-dev');
        } else {
          args.push('--save');
        }
        break;
    }
    
    args.push(...dependencies);
    
    return `${installCmd} ${args.join(' ')}`;
  }
} 