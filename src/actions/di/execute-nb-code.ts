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
  private tempDir: string = 'temp';
  private process: any = null;
  private commonDependencies = ['pandas', 'numpy', 'matplotlib', 'seaborn', 'scikit-learn'];
  
  constructor(llm: LLMProvider) {
    this.llm = llm;
    console.log('[ExecuteNbCode] Initializing ExecuteNbCode');
    
    // Ensure temp directory exists
    this.ensureTempDir();
  }
  
  /**
   * 确保临时目录存在
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`[ExecuteNbCode] Temporary directory created: ${this.tempDir}`);
    } catch (error) {
      console.error('[ExecuteNbCode] Error creating temporary directory:', error);
    }
  }
  
  /**
   * 执行代码
   */
  async run(code: string): Promise<[string, boolean]> {
    console.log('[ExecuteNbCode] Starting code execution');
    console.log('[ExecuteNbCode] Code length:', code.length, 'bytes');
    
    try {
      // Check for required dependencies
      console.log('[ExecuteNbCode] Checking for required dependencies');
      const missingDeps = await this.checkDependencies(code);
      
      if (missingDeps.length > 0) {
        console.log(`[ExecuteNbCode] Missing dependencies detected: ${missingDeps.join(', ')}`);
        const installInstructions = this.getInstallInstructions(missingDeps);
        return [installInstructions, false];
      }
      
      // Create a temporary Python file
      const filename = `${uuidv4()}.py`;
      const filepath = path.join(this.tempDir, filename);
      
      console.log(`[ExecuteNbCode] Writing code to ${filepath}`);
      await fs.writeFile(filepath, code);
      console.log(`[ExecuteNbCode] Code written to temporary file, size: ${(await fs.stat(filepath)).size} bytes`);
      
      // Execute the code
      console.log('[ExecuteNbCode] Executing Python code');
      const [result, success] = await this.executePython(filepath);
      
      // Clean up
      try {
        await fs.unlink(filepath);
        console.log(`[ExecuteNbCode] Removed temporary file: ${filepath}`);
      } catch (cleanupError) {
        console.warn(`[ExecuteNbCode] Failed to remove temporary file: ${filepath}`, cleanupError);
      }
      
      if (success) {
        console.log(`[ExecuteNbCode] Execution successful, output length: ${result.length} bytes`);
      } else {
        console.error(`[ExecuteNbCode] Execution failed: ${result.substring(0, 200)}...`);
      }
      
      return [result, success];
    } catch (error) {
      console.error('[ExecuteNbCode] Error executing code:', error);
      return [`Error executing code: ${error}`, false];
    }
  }
  
  /**
   * 检查代码中使用的依赖是否已安装
   */
  private async checkDependencies(code: string): Promise<string[]> {
    console.log('[ExecuteNbCode] Analyzing code for import statements');
    const importRegex = /import\s+([a-zA-Z0-9_,\s]+)(?:\s+as\s+[a-zA-Z0-9_]+)?|from\s+([a-zA-Z0-9_.]+)\s+import/g;
    const matches = [...code.matchAll(importRegex)];
    
    // Extract module names
    const moduleSet = new Set<string>();
    for (const match of matches) {
      if (match[1]) {
        // import X, Y, Z
        const modules = match[1].split(',').map(m => m.trim().split('.')[0]);
        modules.forEach(m => moduleSet.add(m));
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
        missingDeps.push(module);
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
      const command = `python -c "import ${moduleName}" 2>/dev/null`;
      
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
  private getInstallInstructions(missingDeps: string[]): string {
    const pipCommand = `pip install ${missingDeps.join(' ')}`;
    
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

Original Python Code:
\`\`\`python
${this.getFirstLinesOfCode()}
\`\`\`
...
`;
  }
  
  /**
   * 获取要显示的代码的前几行
   */
  private getFirstLinesOfCode(): string {
    // This would typically show the first few lines of the code
    // Since we don't have the code at this point, we'll return a placeholder
    return "# The generated code requires additional Python packages\n# Please install them using the pip command above";
  }
  
  /**
   * 执行Python代码
   */
  private executePython(filepath: string): Promise<[string, boolean]> {
    return new Promise((resolve) => {
      const command = `python ${filepath}`;
      
      console.log(`[ExecuteNbCode] Running command: ${command}`);
      
      this.process = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`[ExecuteNbCode] Execution error: ${error.message}`);
          
          // Check if the error is due to missing dependencies
          if (stderr.includes('ModuleNotFoundError: No module named')) {
            const match = stderr.match(/ModuleNotFoundError: No module named '([^']+)'/);
            if (match && match[1]) {
              const missingModule = match[1];
              const installCmd = `pip install ${missingModule}`;
              const errorMsg = `
## Missing Dependency: ${missingModule}

Python cannot find the required module: \`${missingModule}\`

Please install it using pip:
\`\`\`
${installCmd}
\`\`\`

After installing the dependency, try running the analysis again.
`;
              resolve([errorMsg, false]);
              return;
            }
          }
          
          resolve([`Execution error: ${error.message}\n${stderr}`, false]);
          return;
        }
        
        if (stderr) {
          console.warn(`[ExecuteNbCode] Stderr: ${stderr}`);
        }
        
        console.log(`[ExecuteNbCode] Execution successful, stdout length: ${stdout.length}`);
        resolve([stdout, true]);
      });
    });
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
} 