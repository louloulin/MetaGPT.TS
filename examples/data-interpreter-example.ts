import { v4 as uuidv4 } from 'uuid';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { DataInterpreter } from '../src/roles/data-interpreter';

/**
 * 数据解释器示例
 * 
 * 该示例演示如何使用数据解释器生成数据分析代码
 */
async function main() {
  console.log(`🚀 开始执行数据分析 [${new Date().toISOString()}]`);
  
  try {
    // 从环境变量获取API密钥
    const apiKey = process.env.DASHSCOPE_API_KEY;
    console.log('✓ 检查环境变量');
    
    if (!apiKey) {
      console.error('❌ 错误: 请设置环境变量: DASHSCOPE_API_KEY');
      process.exit(1);
    }
    console.log('✓ 环境变量已设置');
    
    // 初始化Vercel LLM提供商 - 使用百炼大模型(qwen)
    console.log('⚙️ 配置百炼大模型...');
    const llmProvider = new VercelLLMProvider({
      providerType: 'qwen',
      apiKey,
      model: 'qwen-plus-2025-01-25',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', // 自定义API端点
      extraConfig: {
        qwenOptions: {
          debug: true, // 启用调试日志
        },
        generateOptions: {
          system: '你是一位专业的数据科学家，擅长数据分析、可视化和机器学习。'
        }
      }
    });
    console.log(`✓ 模型配置完成: qwen - qwen-plus-2025-01-25`);
    
    console.log('⚙️ 初始化数据解释器...');
    console.time('数据解释器初始化时间');
    
    // 创建数据解释器
    const dataInterpreter = new DataInterpreter({
      llm: llmProvider,
      auto_run: true,
      use_plan: false,
      use_reflection: true,
      react_mode: 'react',
      max_react_loop: 2,
      tools: ['pandas', 'matplotlib', 'seaborn', 'scikit-learn'],
    });
    
    console.timeEnd('数据解释器初始化时间');
    console.log('✓ 数据解释器初始化完成');
    
    // 设置要分析的数据需求
    const requirement = '使用Python分析鸢尾花数据集，包括基本统计信息、相关性分析和可视化，最后使用SVM算法进行分类。';
    console.log(`📝 数据分析需求: "${requirement}"`);
    
    // 检查Python环境
    console.log('🔍 检查Python环境...');
    await checkPythonEnvironment();
    
    // 执行数据分析
    console.log('🔄 开始数据分析...');
    console.time('数据分析总时间');
    
    const result = await dataInterpreter.react({
      id: uuidv4(),
      role: 'user',
      content: requirement,
      causedBy: 'user-input',
      sentFrom: 'user',
      sendTo: new Set(['*']),
      instructContent: null,
    });
    
    console.timeEnd('数据分析总时间');
    console.log('✅ 数据分析完成!');
    
    // 检查结果中是否有依赖错误
    if (result.content.includes('Missing Dependencies Detected') || result.content.includes('Missing Dependency:')) {
      console.log('⚠️ 检测到缺少Python依赖!');
      console.log('');
      console.log('请安装所需依赖:');
      
      // 提取安装命令
      const pipMatch = result.content.match(/pip install ([^`]+)/);
      if (pipMatch && pipMatch[1]) {
        console.log(`\n运行: pip install ${pipMatch[1].trim()}\n`);
      } else {
        console.log(result.content);
      }
    } else {
      // 正常输出结果
      console.log(`📄 生成结果: ${result.content.substring(0, 200)}...`);
    }
    
    console.log(`🏁 数据分析完成 [${new Date().toISOString()}]`);
  } catch (error) {
    console.error('❌ 数据分析时出错:', error);
    if (error instanceof Error) {
      console.error(`错误类型: ${error.name}`);
      console.error(`错误信息: ${error.message}`);
      console.error(`错误堆栈: ${error.stack}`);
    }
  }
}

/**
 * 检查Python环境
 */
async function checkPythonEnvironment(): Promise<void> {
  const { exec } = require('child_process');
  
  return new Promise((resolve, reject) => {
    // 检查Python版本
    exec('python --version', (error: any, stdout: string, stderr: string) => {
      if (error) {
        console.error('❌ 未检测到Python! 请确保Python已安装并添加到PATH中。');
        reject(new Error('Python not found'));
        return;
      }
      
      console.log(`✓ 检测到Python: ${stdout.trim()}`);
      
      // 检查常用数据科学包
      const packages = ['pandas', 'numpy', 'matplotlib', 'seaborn', 'scikit-learn'];
      let installedCount = 0;
      let missingPackages: string[] = [];
      
      const checkPackage = (index: number) => {
        if (index >= packages.length) {
          // 所有包检查完毕
          console.log(`✓ 已安装的包: ${installedCount}/${packages.length}`);
          
          if (missingPackages.length > 0) {
            const pipCmd = `pip install ${missingPackages.join(' ')}`;
            console.log(`⚠️ 缺少以下Python包: ${missingPackages.join(', ')}`);
            console.log(`💡 建议运行: ${pipCmd}`);
          }
          
          resolve();
          return;
        }
        
        const pkg = packages[index];
        exec(`python -c "import ${pkg}" 2>/dev/null`, (err: any) => {
          if (err) {
            console.log(`✗ 未安装: ${pkg}`);
            missingPackages.push(pkg);
          } else {
            console.log(`✓ 已安装: ${pkg}`);
            installedCount++;
          }
          
          // 检查下一个包
          checkPackage(index + 1);
        });
      };
      
      // 开始检查第一个包
      checkPackage(0);
    });
  });
}

// 运行示例
console.log(' 数据解释器示例');
main(); 