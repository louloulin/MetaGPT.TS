import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { LLMProvider } from '../../types/llm';

/**
 * 执行Notebook代码动作
 */
export class ExecuteNbCode {
  private llm: LLMProvider;
  private baseDir: string = 'workspace'; // 基础目录名从temp改为workspace
  private process: any = null;
  private commonDependencies = ['pandas', 'numpy', 'matplotlib', 'seaborn', 'scikit-learn'];
  private projectPrefix: string = '数据服务';
  private preserveFiles: boolean = true; // 保留临时文件以便后续分析
  private currentWorkspaceDir: string = ''; // 当前任务的工作目录
  private pipCommand: string = 'pip'; // 实际使用的pip命令
  private checkDependencies: boolean = true; // 是否检查依赖
  private autoInstallDependencies: boolean = false; // 是否自动安装依赖
  private skipDependenciesErrors: boolean = false; // 是否跳过依赖错误，直接执行代码
  private useVirtualEnv: boolean = false; // 是否使用虚拟环境
  private virtualEnvName: string = ''; // 当前虚拟环境名称
  private pythonCommand: string = 'python'; // 实际使用的Python命令
  private preInstallCommonDeps: boolean = false; // 是否预安装公共依赖
  
  // 特殊模块名映射表：导入名称 -> pip包名称
  private moduleNameMapping: { [key: string]: string } = {
    'sklearn': 'scikit-learn',
    'PIL': 'Pillow',
    'bs4': 'beautifulsoup4',
    'cv2': 'opencv-python'
  };
  
  constructor(llm: LLMProvider, options?: { 
    projectPrefix?: string, 
    preserveFiles?: boolean, 
    baseDir?: string, 
    setupPipLink?: boolean,
    checkDependencies?: boolean,
    autoInstallDependencies?: boolean,
    skipDependenciesErrors?: boolean,
    useVirtualEnv?: boolean,
    preInstallCommonDeps?: boolean
  }) {
    this.llm = llm;
    console.log('[ExecuteNbCode] Initializing ExecuteNbCode');
    
    // 应用选项
    if (options) {
      if (options.projectPrefix) this.projectPrefix = options.projectPrefix;
      if (options.preserveFiles !== undefined) this.preserveFiles = options.preserveFiles;
      if (options.baseDir) this.baseDir = options.baseDir;
      if (options.checkDependencies !== undefined) this.checkDependencies = options.checkDependencies;
      if (options.autoInstallDependencies !== undefined) this.autoInstallDependencies = options.autoInstallDependencies;
      if (options.skipDependenciesErrors !== undefined) this.skipDependenciesErrors = options.skipDependenciesErrors;
      if (options.useVirtualEnv !== undefined) this.useVirtualEnv = options.useVirtualEnv;
      if (options.preInstallCommonDeps !== undefined) this.preInstallCommonDeps = options.preInstallCommonDeps;
    }
    
    console.log(`[ExecuteNbCode] Configuration:
      - Project Prefix: ${this.projectPrefix}
      - Base Directory: ${this.baseDir}
      - Preserve Files: ${this.preserveFiles}
      - Check Dependencies: ${this.checkDependencies}
      - Auto Install Dependencies: ${this.autoInstallDependencies}
      - Skip Dependencies Errors: ${this.skipDependenciesErrors}
      - Use Virtual Environment: ${this.useVirtualEnv}
      - Pre-install Common Dependencies: ${this.preInstallCommonDeps}
    `);
    
    // 确保基础目录存在
    this.ensureBaseDir();
    
    // 检查并设置pip命令
    const setupPipLink = options?.setupPipLink !== undefined ? options.setupPipLink : true;
    if (setupPipLink) {
      this.setupPipCommand();
    }
  }
  
  /**
   * 检查并设置pip命令，必要时创建pip3到pip的软连接
   */
  private async setupPipCommand(): Promise<void> {
    try {
      console.log('[ExecuteNbCode] Checking pip command configuration...');
      
      // 检查pip命令是否存在
      const hasPip = await this.checkCommandExists('pip');
      
      // 检查pip3命令是否存在
      const hasPip3 = await this.checkCommandExists('pip3');
      
      if (hasPip && hasPip3) {
        // 两个命令都存在，检查pip版本
        const pipVersion = await this.getPipVersion('pip');
        if (pipVersion && pipVersion.startsWith('3.')) {
          // pip已经是Python 3.x版本，使用pip
          this.pipCommand = 'pip';
          console.log('[ExecuteNbCode] Using existing pip command (Python 3.x)');
          return;
        }
      }
      
      if (hasPip3) {
        // 存在pip3，尝试创建软连接
        this.pipCommand = 'pip3';
        console.log('[ExecuteNbCode] Using pip3 command');
        
        // 尝试创建软连接 (可能需要管理员权限)
        try {
          await this.createPipSymlink();
          console.log('[ExecuteNbCode] Successfully created symlink from pip3 to pip');
          this.pipCommand = 'pip'; // 软连接创建成功，使用pip
        } catch (error) {
          console.warn('[ExecuteNbCode] Could not create symlink:', error);
          console.warn('[ExecuteNbCode] Using pip3 command directly instead');
          // 仍然使用pip3
        }
      } else if (hasPip) {
        // 只有pip存在
        console.log('[ExecuteNbCode] Only pip command found, using it');
        this.pipCommand = 'pip';
      } else {
        // 两个命令都不存在
        console.warn('[ExecuteNbCode] Neither pip nor pip3 commands found');
        this.pipCommand = 'pip'; // 默认使用pip，但可能会失败
      }
    } catch (error) {
      console.error('[ExecuteNbCode] Error setting up pip command:', error);
      // 失败时默认使用pip
      this.pipCommand = 'pip';
    }
  }
  
  /**
   * 检查命令是否存在
   */
  private async checkCommandExists(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const checkCmd = process.platform === 'win32'
        ? `where ${command}`
        : `which ${command}`;
      
      exec(checkCmd, (error) => {
        if (error) {
          console.log(`[ExecuteNbCode] Command ${command} not found`);
          resolve(false);
          return;
        }
        
        console.log(`[ExecuteNbCode] Command ${command} exists`);
        resolve(true);
      });
    });
  }
  
  /**
   * 获取pip版本
   */
  private async getPipVersion(pipCmd: string): Promise<string | null> {
    return new Promise((resolve) => {
      exec(`${pipCmd} --version`, (error, stdout) => {
        if (error) {
          console.warn(`[ExecuteNbCode] Error getting ${pipCmd} version:`, error);
          resolve(null);
          return;
        }
        
        const match = stdout.match(/(\d+\.\d+)/);
        if (match && match[1]) {
          console.log(`[ExecuteNbCode] ${pipCmd} version: ${match[1]}`);
          resolve(match[1]);
        } else {
          console.warn(`[ExecuteNbCode] Could not parse ${pipCmd} version from:`, stdout);
          resolve(null);
        }
      });
    });
  }
  
  /**
   * 创建pip3到pip的软连接
   */
  private async createPipSymlink(): Promise<void> {
    return new Promise((resolve, reject) => {
      let createSymlinkCmd = '';
      
      if (process.platform === 'win32') {
        // Windows
        createSymlinkCmd = 'mklink pip pip3';
      } else {
        // Unix-like (Linux, macOS)
        const whichPip3Cmd = 'which pip3';
        
        // 首先获取pip3的实际路径
        exec(whichPip3Cmd, (error, stdout) => {
          if (error) {
            reject(new Error(`Failed to get pip3 path: ${error.message}`));
            return;
          }
          
          const pip3Path = stdout.trim();
          // 获取目录路径
          const dirPath = path.dirname(pip3Path);
          const pipPath = path.join(dirPath, 'pip');
          
          // 检查pip是否已存在，如果存在则先备份
          fs.access(pipPath)
            .then(() => {
              const backupPath = `${pipPath}.bak`;
              return fs.rename(pipPath, backupPath)
                .then(() => console.log(`[ExecuteNbCode] Backed up existing pip to ${backupPath}`));
            })
            .catch(() => {
              // pip不存在，不需要备份
            })
            .finally(() => {
              // 创建软连接
              const symlinkCmd = `ln -sf ${pip3Path} ${pipPath}`;
              exec(symlinkCmd, (symlinkError) => {
                if (symlinkError) {
                  // 尝试使用sudo（可能需要密码）
                  console.warn('[ExecuteNbCode] Failed to create symlink without sudo, trying with sudo...');
                  const sudoCmd = `sudo ln -sf ${pip3Path} ${pipPath}`;
                  
                  exec(sudoCmd, (sudoError) => {
                    if (sudoError) {
                      reject(new Error(`Failed to create symlink with sudo: ${sudoError.message}`));
                    } else {
                      console.log(`[ExecuteNbCode] Created symlink from ${pip3Path} to ${pipPath} with sudo`);
                      resolve();
                    }
                  });
                } else {
                  console.log(`[ExecuteNbCode] Created symlink from ${pip3Path} to ${pipPath}`);
                  resolve();
                }
              });
            });
        });
        return; // 异步处理，提前返回
      }
      
      // Windows的同步处理继续
      if (process.platform === 'win32') {
        exec(createSymlinkCmd, (error) => {
          if (error) {
            reject(new Error(`Failed to create symlink on Windows: ${error.message}`));
          } else {
            console.log('[ExecuteNbCode] Created symlink from pip3 to pip on Windows');
            resolve();
          }
        });
      }
    });
  }
  
  /**
   * 确保基础目录存在
   */
  private async ensureBaseDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      console.log(`[ExecuteNbCode] Base directory created: ${this.baseDir}`);
    } catch (error) {
      console.error('[ExecuteNbCode] Error creating base directory:', error);
    }
  }
  
  /**
   * 创建时间戳字符串
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
  }
  
  /**
   * 创建新的工作目录
   */
  private async createWorkspaceDir(): Promise<string> {
    const timestamp = this.getTimestamp();
    const workspaceName = `${this.projectPrefix}-${timestamp}`;
    const workspacePath = path.join(this.baseDir, workspaceName);
    
    try {
      await fs.mkdir(workspacePath, { recursive: true });
      console.log(`[ExecuteNbCode] Created workspace directory: ${workspacePath}`);
      this.currentWorkspaceDir = workspacePath;
      return workspacePath;
    } catch (error) {
      console.error(`[ExecuteNbCode] Error creating workspace directory: ${workspacePath}`, error);
      throw error;
    }
  }
  
  /**
   * 运行前创建虚拟环境（如果启用）
   * @param workspaceDir 工作目录
   * @returns 是否成功创建虚拟环境
   */
  private async setupVirtualEnv(workspaceDir: string): Promise<boolean> {
    if (!this.useVirtualEnv) {
      return true; // 如果未启用虚拟环境，则直接返回成功
    }
    
    // 检查virtualenv是否已安装
    const hasVirtualenv = await this.checkCommandExists('virtualenv');
    if (!hasVirtualenv) {
      console.warn('[ExecuteNbCode] virtualenv not found, attempting to install it');
      const installResult = await new Promise<boolean>((resolve) => {
        const installCmd = `${this.pipCommand} install virtualenv`;
        exec(installCmd, (error) => {
          if (error) {
            console.error(`[ExecuteNbCode] Failed to install virtualenv: ${error.message}`);
            resolve(false);
          } else {
            console.log('[ExecuteNbCode] Successfully installed virtualenv');
            resolve(true);
          }
        });
      });
      
      if (!installResult) {
        console.error('[ExecuteNbCode] Could not install virtualenv, falling back to system Python');
        return false;
      }
    }
    
    // 创建虚拟环境名称 (使用工作目录的basename)
    this.virtualEnvName = path.basename(workspaceDir);
    const venvPath = path.join(workspaceDir, '.venv');
    
    console.log(`[ExecuteNbCode] Creating virtual environment at: ${venvPath}`);
    
    // 创建虚拟环境
    const createResult = await new Promise<boolean>((resolve) => {
      const createCmd = `virtualenv "${venvPath}"`;
      exec(createCmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`[ExecuteNbCode] Failed to create virtual environment: ${error.message}`);
          console.error(`[ExecuteNbCode] Stderr: ${stderr}`);
          resolve(false);
        } else {
          console.log(`[ExecuteNbCode] Successfully created virtual environment`);
          console.log(stdout);
          resolve(true);
        }
      });
    });
    
    if (!createResult) {
      console.error('[ExecuteNbCode] Virtual environment creation failed, falling back to system Python');
      return false;
    }
    
    // 根据操作系统设置虚拟环境中的Python命令
    if (process.platform === 'win32') {
      this.pythonCommand = path.join(venvPath, 'Scripts', 'python.exe');
      this.pipCommand = path.join(venvPath, 'Scripts', 'pip.exe');
    } else {
      this.pythonCommand = path.join(venvPath, 'bin', 'python');
      this.pipCommand = path.join(venvPath, 'bin', 'pip');
    }
    
    console.log(`[ExecuteNbCode] Using virtual environment Python: ${this.pythonCommand}`);
    console.log(`[ExecuteNbCode] Using virtual environment Pip: ${this.pipCommand}`);
    
    // 预安装常用数据科学依赖包
    if (this.preInstallCommonDeps && this.commonDependencies.length > 0) {
      console.log('[ExecuteNbCode] Pre-installing common data science packages in virtual environment');
      
      // 将常用依赖写入临时requirements文件
      const tempRequirementsPath = path.join(workspaceDir, 'common_requirements.txt');
      await fs.writeFile(tempRequirementsPath, this.commonDependencies.join('\n'));
      
      // 安装依赖
      const installResult = await new Promise<boolean>((resolve) => {
        const installCmd = `${this.pipCommand} install -r "${tempRequirementsPath}"`;
        console.log(`[ExecuteNbCode] Running: ${installCmd}`);
        
        exec(installCmd, (error, stdout, stderr) => {
          if (error) {
            console.error(`[ExecuteNbCode] Failed to pre-install dependencies: ${error.message}`);
            console.error(`[ExecuteNbCode] Stderr: ${stderr}`);
            resolve(false);
          } else {
            console.log(`[ExecuteNbCode] Successfully pre-installed common dependencies`);
            console.log(stdout);
            resolve(true);
          }
        });
      });
      
      if (!installResult) {
        console.warn('[ExecuteNbCode] Failed to pre-install common dependencies, but continuing with virtual environment');
      }
    }
    
    return true;
  }
  
  /**
   * 执行代码
   */
  async run(code: string): Promise<[string, boolean]> {
    console.log('[ExecuteNbCode] Starting code execution');
    console.log('[ExecuteNbCode] Code length:', code.length, 'bytes');
    
    try {
      // 创建新的工作目录
      const workspaceDir = await this.createWorkspaceDir();
      console.log(`[ExecuteNbCode] Using workspace directory: ${workspaceDir}`);
      
      // 设置虚拟环境（如果启用）
      if (this.useVirtualEnv) {
        const venvSuccess = await this.setupVirtualEnv(workspaceDir);
        if (!venvSuccess) {
          console.warn('[ExecuteNbCode] Failed to set up virtual environment, using system Python');
          // 重置Python和pip命令到系统默认
          this.pythonCommand = 'python';
          this.setupPipCommand(); // 重新设置pip命令
        }
      }
      
      // 检查依赖（如果启用）
      let missingDeps: string[] = [];
      if (this.checkDependencies) {
        console.log('[ExecuteNbCode] Checking for required dependencies');
        missingDeps = await this.checkModuleDependencies(code);
        
        if (missingDeps.length > 0) {
          console.log(`[ExecuteNbCode] Missing dependencies detected: ${missingDeps.join(', ')}`);
          
          // 保存依赖信息到工作目录
          const requirementsPath = path.join(workspaceDir, 'requirements.txt');
          await fs.writeFile(requirementsPath, missingDeps.join('\n'));
          console.log(`[ExecuteNbCode] Saved missing dependencies to: ${requirementsPath}`);
          
          // 如果不跳过依赖错误且不自动安装，则返回安装指令
          if (!this.skipDependenciesErrors && !this.autoInstallDependencies) {
            const installInstructions = this.getInstallInstructions(missingDeps, workspaceDir);
            return [installInstructions, false];
          }
          
          // 如果配置为自动安装依赖
          if (this.autoInstallDependencies) {
            console.log('[ExecuteNbCode] Attempting to automatically install dependencies');
            const [installSuccess, installOutput] = await this.installDependencies(requirementsPath);
            
            if (!installSuccess && !this.skipDependenciesErrors) {
              console.error('[ExecuteNbCode] Failed to install dependencies automatically');
              return [`Failed to install dependencies automatically:\n${installOutput}`, false];
            }
          }
          
          // 如果skipDependenciesErrors=true，则继续执行，即使缺少依赖
          if (this.skipDependenciesErrors) {
            console.warn('[ExecuteNbCode] Missing dependencies, but continuing due to skipDependenciesErrors=true');
          }
        }
      }
      
      // 确保代码是可执行的Python代码
      const executableCode = this.ensureExecutableCode(code);
      
      // 在工作目录中创建主Python文件
      const filepath = path.join(workspaceDir, 'main.py');
      
      console.log(`[ExecuteNbCode] Writing code to ${filepath}`);
      await fs.writeFile(filepath, executableCode);
      console.log(`[ExecuteNbCode] Code written to file, size: ${(await fs.stat(filepath)).size} bytes`);
      
      // 创建README.md文件描述任务
      const readmePath = path.join(workspaceDir, 'README.md');
      await fs.writeFile(readmePath, this.generateReadme(workspaceDir));
      
      // Execute the code
      console.log('[ExecuteNbCode] Executing Python code');
      const [result, success] = await this.executePython(filepath, workspaceDir);
      
      // 保存执行结果
      const outputPath = path.join(workspaceDir, success ? 'output.txt' : 'error.txt');
      await fs.writeFile(outputPath, result);
      console.log(`[ExecuteNbCode] Saved ${success ? 'output' : 'error'} to: ${outputPath}`);
      
      if (success) {
        console.log(`[ExecuteNbCode] Execution successful, output length: ${result.length} bytes`);
      } else {
        console.error(`[ExecuteNbCode] Execution failed. See error.txt in workspace: ${workspaceDir}`);
        console.error(`[ExecuteNbCode] Error: ${result.substring(0, 200)}...`);
      }
      
      // 如果不保留文件，删除整个工作目录
      if (!this.preserveFiles) {
        try {
          await fs.rm(workspaceDir, { recursive: true, force: true });
          console.log(`[ExecuteNbCode] Removed workspace directory: ${workspaceDir}`);
          this.currentWorkspaceDir = '';
        } catch (cleanupError) {
          console.warn(`[ExecuteNbCode] Failed to remove workspace directory: ${workspaceDir}`, cleanupError);
        }
      } else {
        console.log(`[ExecuteNbCode] Preserved workspace for analysis: ${workspaceDir}`);
      }
      
      return [result, success];
    } catch (error) {
      console.error('[ExecuteNbCode] Error executing code:', error);
      return [`Error executing code: ${error}`, false];
    }
  }
  
  /**
   * 生成README内容
   */
  private generateReadme(workspaceDir: string): string {
    const timestamp = new Date().toISOString();
    return `# 数据分析任务
生成时间: ${timestamp}
工作目录: ${workspaceDir}

## 文件说明
- main.py: 主要代码文件
- output.txt: 执行输出 (如果执行成功)
- error.txt: 错误信息 (如果执行失败)
- requirements.txt: 依赖项 (如果有缺失依赖)
- *.png, *.jpg, *.csv: 生成的图表和数据文件

## 执行方法
\`\`\`bash
cd "${workspaceDir}"
python main.py
\`\`\`
`;
  }
  
  /**
   * 确保代码是可执行的Python代码
   * 修复"LLM生成模拟响应"这样的非代码文本
   */
  private ensureExecutableCode(code: string): string {
    // 检查代码是否只是一个简单字符串而不是真正的Python代码
    if (!code.includes('\n') && !code.includes('=') && !code.includes('import') && 
        !code.includes('def ') && !code.includes('class ') && !code.includes('print(')) {
      // 如果是简单字符串，则将其包装成print语句
      return `print("""${code}""")`;
    }
    
    // 如果启用了跳过依赖错误，则为导入语句添加错误处理
    if (this.skipDependenciesErrors) {
      // 提取所有导入语句
      const importRegex = /^(?:import\s+[\w\s,]+(?:\s+as\s+\w+)?|from\s+[\w\.]+\s+import\s+[\w\s,\*]+)$/gm;
      const importStatements = [...code.matchAll(importRegex)].map(match => match[0]);
      
      if (importStatements.length > 0) {
        console.log('[ExecuteNbCode] Adding error handling to import statements');
        
        // 用处理错误的版本替换导入语句
        let modifiedCode = code;
        for (const importStmt of importStatements) {
          const safeImport = `
try:
    ${importStmt}
except ImportError as e:
    print(f"Warning: Could not import - {e}")
    # 创建模拟模块
    class MockModule:
        def __getattr__(self, name):
            return lambda *args, **kwargs: None
    
    # 提取模块名
    if '${importStmt}'.startswith('import '):
        module_name = '${importStmt}'.replace('import ', '').split(' as ')[0].strip().split(',')[0].strip()
        if ' as ' in '${importStmt}':
            alias = '${importStmt}'.split(' as ')[1].strip()
            globals()[alias] = MockModule()
        else:
            globals()[module_name] = MockModule()
    elif '${importStmt}'.startswith('from '):
        module_parts = '${importStmt}'.split(' import ')
        from_module = module_parts[0].replace('from ', '').strip()
        imported_items = module_parts[1].split(',')
        for item in imported_items:
            item_name = item.strip()
            globals()[item_name] = lambda *args, **kwargs: None
`;
          modifiedCode = modifiedCode.replace(importStmt, safeImport);
        }
        
        return modifiedCode;
      }
    }
    
    return code;
  }
  
  /**
   * 检查代码中使用的依赖是否已安装
   */
  private async checkModuleDependencies(code: string): Promise<string[]> {
    console.log('[ExecuteNbCode] Analyzing code for import statements');
    // 使用更精确的正则表达式匹配导入语句，但仅提取包名而不包含别名
    const importRegex = /import\s+([a-zA-Z0-9_,\s]+)(?:\s+as\s+[a-zA-Z0-9_]+)?|from\s+([a-zA-Z0-9_.]+)\s+import/g;
    const matches = [...code.matchAll(importRegex)];
    
    // Extract module names
    const moduleSet = new Set<string>();
    for (const match of matches) {
      if (match[1]) {
        // import X, Y, Z (possibly with 'as' aliases)
        // 分割并清理模块名，移除所有 'as' 部分
        const importParts = match[1].split(',');
        for (const part of importParts) {
          // 移除 'as' 及其后面的别名
          const cleanPart = part.trim().split(/\s+as\s+/)[0].trim();
          if (cleanPart) {
            // 只保留包名的根部分
            moduleSet.add(cleanPart.split('.')[0]);
          }
        }
      } else if (match[2]) {
        // from X import Y
        moduleSet.add(match[2].split('.')[0]);
      }
    }
    
    console.log(`[ExecuteNbCode] Detected modules: ${Array.from(moduleSet).join(', ')}`);
    
    // Check if modules are installed
    const missingDeps: string[] = [];
    for (const module of moduleSet) {
      // Skip standard library modules
      if (['os', 'sys', 'time', 'datetime', 'json', 'math', 'random', 're'].includes(module)) {
        continue;
      }
      
      // Check if module is installed
      const isInstalled = await this.isModuleInstalled(module);
      if (!isInstalled) {
        // 使用模块名映射来获取正确的包名
        const packageName = this.moduleNameMapping[module] || module;
        missingDeps.push(packageName);
      }
    }
    
    return missingDeps;
  }
  
  /**
   * 检查模块是否已安装
   */
  private async isModuleInstalled(moduleName: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`[ExecuteNbCode] Checking if module is installed: ${moduleName}`);
      const command = `${this.pythonCommand} -c "import ${moduleName}" 2>/dev/null`;
      
      exec(command, (error) => {
        if (error) {
          console.log(`[ExecuteNbCode] Module ${moduleName} is not installed`);
          resolve(false);
          return;
        }
        
        console.log(`[ExecuteNbCode] Module ${moduleName} is installed`);
        resolve(true);
      });
    });
  }
  
  /**
   * 获取安装说明
   */
  private getInstallInstructions(missingDeps: string[], workspaceDir: string): string {
    const pipCommand = `${this.pipCommand} install -r "${path.join(workspaceDir, 'requirements.txt')}"`;
    
    return `
## Missing Dependencies Detected

The following Python packages are required but not installed:
\`\`\`
${missingDeps.join('\n')}
\`\`\`

Please install these dependencies using pip:
\`\`\`
${pipCommand}
\`\`\`

After installing the dependencies, try running the analysis again.

Python code has been saved to the workspace directory:
\`${workspaceDir}\`
`;
  }
  
  /**
   * 执行Python代码
   */
  private executePython(filepath: string, workspaceDir: string): Promise<[string, boolean]> {
    return new Promise((resolve) => {
      // 切换到工作目录执行，这样相对路径会在正确的位置
      const command = `cd "${workspaceDir}" && ${this.pythonCommand} "${path.basename(filepath)}"`;
      
      console.log(`[ExecuteNbCode] Running command: ${command}`);
      
      this.process = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`[ExecuteNbCode] Execution error: ${error.message}`);
          
          // 保存错误信息
          const errorFilePath = path.join(workspaceDir, 'error.log');
          fs.writeFile(errorFilePath, `
Command: ${command}
Error: ${error.message}
Stdout: ${stdout}
Stderr: ${stderr}
          `).catch(e => console.error(`Failed to write error log: ${e}`));
          
          console.log(`[ExecuteNbCode] Error details saved to: ${errorFilePath}`);
          
          // Check if the error is due to missing dependencies
          if (stderr.includes('ModuleNotFoundError: No module named')) {
            const match = stderr.match(/ModuleNotFoundError: No module named '([^']+)'/);
            if (match && match[1]) {
              const missingModule = match[1];
              
              // 提取纯包名，不包含子模块或别名部分
              const packageName = missingModule.split('.')[0];
              
              // 使用模块名映射来获取正确的pip包名
              const pipPackageName = this.moduleNameMapping[packageName] || packageName;
              
              // 将缺失的模块保存到requirements.txt
              const requirementsPath = path.join(workspaceDir, 'requirements.txt');
              fs.appendFile(requirementsPath, `${pipPackageName}\n`)
                .catch(e => console.error(`Failed to update requirements.txt: ${e}`));
              
              // 如果配置为自动安装依赖
              if (this.autoInstallDependencies) {
                this.installDependencies(requirementsPath)
                  .then(([installSuccess, installOutput]) => {
                    if (installSuccess) {
                      // 安装成功后重新执行代码
                      console.log('[ExecuteNbCode] Dependencies installed successfully, retrying execution');
                      this.executePython(filepath, workspaceDir)
                        .then(([retryResult, retrySuccess]) => {
                          resolve([retryResult, retrySuccess]);
                        });
                    } else if (this.skipDependenciesErrors) {
                      // 安装失败但配置为跳过依赖错误，返回原始错误
                      console.warn('[ExecuteNbCode] Dependency installation failed but continuing due to skipDependenciesErrors=true');
                      resolve([`Execution continued despite missing dependency: ${missingModule}\n\n${stdout}`, true]);
                    } else {
                      // 安装失败且不跳过依赖错误
                      resolve([`Failed to install dependency: ${pipPackageName}\n${installOutput}`, false]);
                    }
                  });
                return; // 异步处理，提前返回
              }
              
              // 如果配置为跳过依赖错误
              if (this.skipDependenciesErrors) {
                console.warn(`[ExecuteNbCode] Missing dependency: ${missingModule}, but continuing due to skipDependenciesErrors=true`);
                resolve([`Execution continued despite missing dependency: ${missingModule}\n\n${stdout}`, true]);
                return;
              }
              
              // 默认行为：提供安装指令
              const installCmd = `${this.pipCommand} install -r "${requirementsPath}"`;
              const errorMsg = `
## Missing Dependency: ${pipPackageName}

Python cannot find the required module: \`${missingModule}\`

Please install it using pip:
\`\`\`
${installCmd}
\`\`\`

After installing the dependency, try running the analysis again.

Python code has been saved to the workspace directory:
\`${workspaceDir}\`
`;
              resolve([errorMsg, false]);
              return;
            }
          }
          
          // 如果有其他类型的错误但配置为跳过依赖错误
          if (this.skipDependenciesErrors && stderr.includes('Error')) {
            console.warn('[ExecuteNbCode] Execution error occurred, but continuing due to skipDependenciesErrors=true');
            // 尝试保留任何有用的输出
            if (stdout.trim()) {
              resolve([`Execution completed with errors, but continuing due to configuration.\n\nOutput:\n${stdout}`, true]);
            } else {
              resolve([`Execution failed with error: ${error.message}\nBut continuing due to configuration.`, true]);
            }
            return;
          }
          
          resolve([`Execution error: ${error.message}\n${stderr}`, false]);
          return;
        }
        
        if (stderr) {
          console.warn(`[ExecuteNbCode] Stderr: ${stderr}`);
          
          // 保存警告信息
          const warningFilePath = path.join(workspaceDir, 'warnings.log');
          fs.writeFile(warningFilePath, stderr)
            .catch(e => console.error(`Failed to write warnings log: ${e}`));
        }
        
        console.log(`[ExecuteNbCode] Execution successful, stdout length: ${stdout.length}`);
        resolve([stdout, true]);
      });
    });
  }
  
  /**
   * 获取当前工作目录
   */
  public getCurrentWorkspace(): string {
    return this.currentWorkspaceDir;
  }
  
  /**
   * 终止执行
   */
  async terminate(): Promise<void> {
    if (this.process) {
      console.log('[ExecuteNbCode] Terminating process');
      this.process.kill();
      this.process = null;
    }
  }
  
  /**
   * 安装依赖
   * @param requirementsPath requirements.txt 的路径
   * @returns [success, output] 安装是否成功，输出内容
   */
  private async installDependencies(requirementsPath: string): Promise<[boolean, string]> {
    return new Promise((resolve) => {
      // 构建安装命令
      const installCmd = `${this.pipCommand} install -r "${requirementsPath}"`;
      console.log(`[ExecuteNbCode] Running dependency installation: ${installCmd}`);
      
      exec(installCmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`[ExecuteNbCode] Failed to install dependencies: ${error.message}`);
          console.error(`[ExecuteNbCode] Stderr: ${stderr}`);
          
          // 尝试使用 --user 标志再次尝试安装（非管理员权限）
          const userInstallCmd = `${this.pipCommand} install --user -r "${requirementsPath}"`;
          console.log(`[ExecuteNbCode] Trying with --user flag: ${userInstallCmd}`);
          
          exec(userInstallCmd, (userError, userStdout, userStderr) => {
            if (userError) {
              console.error(`[ExecuteNbCode] Failed to install dependencies with --user flag: ${userError.message}`);
              resolve([false, `Installation error: ${error.message}\n${stderr}\n\nTried with --user flag: ${userError.message}\n${userStderr}`]);
            } else {
              console.log(`[ExecuteNbCode] Successfully installed dependencies with --user flag`);
              resolve([true, userStdout]);
            }
          });
        } else {
          console.log(`[ExecuteNbCode] Successfully installed dependencies`);
          resolve([true, stdout]);
        }
      });
    });
  }
} 