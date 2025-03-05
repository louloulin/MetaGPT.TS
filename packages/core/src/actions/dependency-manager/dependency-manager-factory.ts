import { logger } from '../../utils/logger';
import { DependencyManager } from './dependency-manager';
import type { DependencyManagerConfig } from './dependency-manager';
import { PythonDependencyManager } from './python-dependency-manager';
import type { PythonDependencyManagerConfig } from './python-dependency-manager';
import { NodejsDependencyManager } from './nodejs-dependency-manager';
import type { NodejsDependencyManagerConfig } from './nodejs-dependency-manager';

/**
 * 支持的语言类型
 */
export type SupportedLanguage = 'python' | 'nodejs';

/**
 * 语言特定配置类型
 */
export type LanguageSpecificConfig = 
  | { language: 'python', config: PythonDependencyManagerConfig }
  | { language: 'nodejs', config: NodejsDependencyManagerConfig };

/**
 * 依赖管理器工厂
 * 用于创建不同语言的依赖管理器
 */
export class DependencyManagerFactory {
  /**
   * 创建依赖管理器
   * @param language 语言类型
   * @param config 配置
   */
  static create(language: SupportedLanguage, config?: DependencyManagerConfig): DependencyManager {
    logger.info(`[DependencyManagerFactory] Creating dependency manager for language: ${language}`);
    
    switch (language) {
      case 'python':
        return new PythonDependencyManager(config as PythonDependencyManagerConfig);
        
      case 'nodejs':
        return new NodejsDependencyManager(config as NodejsDependencyManagerConfig);
        
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }
  
  /**
   * 从文件扩展名推断语言类型
   * @param filename 文件名
   */
  static inferLanguageFromFilename(filename: string): SupportedLanguage | null {
    if (!filename) {
      return null;
    }
    
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'py':
        return 'python';
        
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return 'nodejs';
        
      default:
        return null;
    }
  }
  
  /**
   * 从代码推断语言类型
   * @param code 代码
   */
  static inferLanguageFromCode(code: string): SupportedLanguage | null {
    if (!code) {
      return null;
    }
    
    // Python 特征
    const pythonFeatures = [
      'import numpy',
      'import pandas',
      'import matplotlib',
      'def ',
      'print(',
      'if __name__ == "__main__":'
    ];
    
    // Node.js 特征
    const nodejsFeatures = [
      'import {',
      'require(',
      'export ',
      'module.exports',
      'const ',
      'let ',
      'function(',
      '=>'
    ];
    
    // 计算特征匹配得分
    let pythonScore = 0;
    let nodejsScore = 0;
    
    pythonFeatures.forEach(feature => {
      if (code.includes(feature)) {
        pythonScore++;
      }
    });
    
    nodejsFeatures.forEach(feature => {
      if (code.includes(feature)) {
        nodejsScore++;
      }
    });
    
    // 根据得分确定语言类型
    if (pythonScore > nodejsScore) {
      return 'python';
    } else if (nodejsScore > pythonScore) {
      return 'nodejs';
    }
    
    return null;
  }
} 