/**
 * @module InitCommand
 * @category CLI Commands
 * @description Command to initialize a new MetaGPT project
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Command } from '../command';
import type { CommandArguments, CommandOptions, CommandContext, CommandMeta } from '../command';
import { logger } from '../../utils/logger';
import { z } from 'zod';

/**
 * Schema for project initialization configuration
 */
export const InitConfigSchema = z.object({
  /** Project name */
  name: z.string(),
  /** Project description */
  description: z.string().default('A MetaGPT TypeScript project'),
  /** Project author */
  author: z.string().default(''),
  /** Project version */
  version: z.string().default('0.1.0'),
  /** Project license */
  license: z.string().default('MIT'),
  /** Enable TypeScript */
  typescript: z.boolean().default(true),
  /** Enable ESLint */
  eslint: z.boolean().default(true),
  /** Enable Prettier */
  prettier: z.boolean().default(true),
  /** Enable Jest */
  jest: z.boolean().default(true),
  /** Initialize Git repository */
  git: z.boolean().default(true),
  /** Initialize with sample code */
  samples: z.boolean().default(true),
});

export type InitConfig = z.infer<typeof InitConfigSchema>;

/**
 * Command to initialize a new MetaGPT project
 */
export class InitCommand extends Command {
  /**
   * Create a new init command
   */
  constructor() {
    const meta: CommandMeta = {
      name: 'init',
      description: 'Initialize a new MetaGPT project',
      aliases: ['create', 'new'],
      examples: [
        'metagpt init',
        'metagpt init my-project',
        'metagpt init --typescript=false',
        'metagpt init --no-git',
      ],
      category: 'Project',
    };
    
    super(meta);
  }
  
  /**
   * Execute the command
   * @param args Command arguments
   * @param options Command options
   * @param context Command context
   * @returns Promise that resolves when the command completes
   */
  public async execute(
    args: CommandArguments,
    options: CommandOptions,
    context: CommandContext
  ): Promise<void> {
    // Get project name
    let projectName = (args['0'] as string) || '';
    
    // If no project name provided, prompt for one
    if (!projectName) {
      // Use empty string as fallback to handle potential undefined
      const inputName = (await context.input('Project name: ')) || '';
      
      if (inputName.trim() === '') {
        context.output('Project name is required', 'error');
        return;
      }
      
      projectName = inputName.trim();
    }
    
    // Prepare config
    const config: Partial<InitConfig> = {
      name: projectName,
    };
    
    // Process options
    const processedOptions = this.processOptions(options);
    Object.assign(config, processedOptions);
    
    // If no options provided, run interactive setup
    if (Object.keys(processedOptions).length === 0) {
      await this.runInteractiveSetup(config, context);
    }
    
    // Validate config
    try {
      InitConfigSchema.parse(config);
    } catch (error) {
      context.output(`Invalid configuration: ${error}`, 'error');
      return;
    }
    
    // Create project
    context.output(`\nCreating project ${config.name}...`, 'info');
    const projectDir = path.join(context.cwd, config.name);
    
    // Check if directory exists
    try {
      const stats = await fs.stat(projectDir);
      if (stats.isDirectory()) {
        const overwrite = await context.input(`Directory ${config.name} already exists. Overwrite? (y/N): `);
        if (overwrite.toLowerCase() !== 'y') {
          context.output('Project creation aborted', 'info');
          return;
        }
      }
    } catch (error) {
      // Directory doesn't exist, which is fine
    }
    
    // Create project directory
    await fs.mkdir(projectDir, { recursive: true });
    
    // Track progress
    const progress = context.progress(7);
    let step = 0;
    
    try {
      // Create package.json
      context.output('\nCreating package.json...', 'info');
      await this.createPackageJson(projectDir, config);
      progress.update(++step);
      
      // Create tsconfig.json if TypeScript is enabled
      if (config.typescript) {
        context.output('Creating tsconfig.json...', 'info');
        await this.createTsConfig(projectDir);
        progress.update(++step);
      } else {
        progress.update(++step);
      }
      
      // Create README.md
      context.output('Creating README.md...', 'info');
      await this.createReadme(projectDir, config);
      progress.update(++step);
      
      // Create .gitignore if Git is enabled
      if (config.git) {
        context.output('Creating .gitignore...', 'info');
        await this.createGitignore(projectDir);
        progress.update(++step);
      } else {
        progress.update(++step);
      }
      
      // Create ESLint config if ESLint is enabled
      if (config.eslint) {
        context.output('Creating ESLint config...', 'info');
        await this.createEslintConfig(projectDir, config);
        progress.update(++step);
      } else {
        progress.update(++step);
      }
      
      // Create Prettier config if Prettier is enabled
      if (config.prettier) {
        context.output('Creating Prettier config...', 'info');
        await this.createPrettierConfig(projectDir);
        progress.update(++step);
      } else {
        progress.update(++step);
      }
      
      // Create sample code if samples are enabled
      if (config.samples) {
        context.output('Creating sample code...', 'info');
        await this.createSampleCode(projectDir, config);
        progress.update(++step);
      } else {
        progress.update(++step);
      }
      
      // Initialize Git repository if Git is enabled
      if (config.git) {
        context.output('Initializing Git repository...', 'info');
        await this.initGit(projectDir, context);
      }
      
      progress.complete();
      context.output(`\n✨ Project ${config.name} created successfully!\n`, 'success');
      
      // Show next steps
      this.showNextSteps(config, context);
    } catch (error) {
      progress.complete();
      context.output(`Error creating project: ${error}`, 'error');
    }
  }
  
  /**
   * Process command options
   * @param options Command options
   * @returns Processed options
   */
  private processOptions(options: CommandOptions): Partial<InitConfig> {
    const result: Partial<InitConfig> = {};
    
    // Process options
    if ('description' in options) {
      result.description = options.description as string;
    }
    
    if ('author' in options) {
      result.author = options.author as string;
    }
    
    if ('version' in options) {
      result.version = options.version as string;
    }
    
    if ('license' in options) {
      result.license = options.license as string;
    }
    
    // Handle boolean options (support both --typescript=false and --no-typescript)
    if ('typescript' in options) {
      result.typescript = options.typescript === true;
    } else if ('no-typescript' in options) {
      result.typescript = false;
    }
    
    if ('eslint' in options) {
      result.eslint = options.eslint === true;
    } else if ('no-eslint' in options) {
      result.eslint = false;
    }
    
    if ('prettier' in options) {
      result.prettier = options.prettier === true;
    } else if ('no-prettier' in options) {
      result.prettier = false;
    }
    
    if ('jest' in options) {
      result.jest = options.jest === true;
    } else if ('no-jest' in options) {
      result.jest = false;
    }
    
    if ('git' in options) {
      result.git = options.git === true;
    } else if ('no-git' in options) {
      result.git = false;
    }
    
    if ('samples' in options) {
      result.samples = options.samples === true;
    } else if ('no-samples' in options) {
      result.samples = false;
    }
    
    return result;
  }
  
  /**
   * Run interactive setup
   * @param config Initial configuration
   * @param context Command context
   */
  private async runInteractiveSetup(config: Partial<InitConfig>, context: CommandContext): Promise<void> {
    context.output('\nProject Setup', 'info');
    context.output('Please answer the following questions to set up your project.\n', 'info');
    
    // Prompt for description
    const description = await context.input(`Description [${config.description || 'A MetaGPT TypeScript project'}]: `);
    if (description) {
      config.description = description;
    } else if (!config.description) {
      config.description = 'A MetaGPT TypeScript project';
    }
    
    // Prompt for author
    const author = await context.input(`Author [${config.author || ''}]: `);
    if (author) {
      config.author = author;
    }
    
    // Prompt for version
    const version = await context.input(`Version [${config.version || '0.1.0'}]: `);
    if (version) {
      config.version = version;
    } else if (!config.version) {
      config.version = '0.1.0';
    }
    
    // Prompt for license
    const license = await context.input(`License [${config.license || 'MIT'}]: `);
    if (license) {
      config.license = license;
    } else if (!config.license) {
      config.license = 'MIT';
    }
    
    // Prompt for TypeScript
    const typescript = await context.input(`Use TypeScript? (Y/n): `);
    config.typescript = typescript.toLowerCase() !== 'n';
    
    // Prompt for ESLint
    const eslint = await context.input(`Use ESLint? (Y/n): `);
    config.eslint = eslint.toLowerCase() !== 'n';
    
    // Prompt for Prettier
    const prettier = await context.input(`Use Prettier? (Y/n): `);
    config.prettier = prettier.toLowerCase() !== 'n';
    
    // Prompt for Jest
    const jest = await context.input(`Use Jest? (Y/n): `);
    config.jest = jest.toLowerCase() !== 'n';
    
    // Prompt for Git
    const git = await context.input(`Initialize Git repository? (Y/n): `);
    config.git = git.toLowerCase() !== 'n';
    
    // Prompt for samples
    const samples = await context.input(`Include sample code? (Y/n): `);
    config.samples = samples.toLowerCase() !== 'n';
  }
  
  /**
   * Create package.json file
   * @param projectDir Project directory
   * @param config Project configuration
   */
  private async createPackageJson(projectDir: string, config: Partial<InitConfig>): Promise<void> {
    const packageJson: Record<string, any> = {
      name: config.name,
      version: config.version,
      description: config.description,
      author: config.author,
      license: config.license,
      scripts: {
        start: config.typescript ? 'ts-node src/index.ts' : 'node src/index.js',
        build: config.typescript ? 'tsc' : 'echo "No build step"',
      },
      dependencies: {
        'metagpt-ts': '^0.1.0',
      },
      devDependencies: {},
    };
    
    // Add TypeScript dependencies
    if (config.typescript) {
      packageJson.devDependencies['typescript'] = '^5.0.0';
      packageJson.devDependencies['ts-node'] = '^10.9.1';
      packageJson.devDependencies['@types/node'] = '^18.0.0';
    }
    
    // Add ESLint dependencies
    if (config.eslint) {
      packageJson.scripts.lint = 'eslint . --ext .js,.ts';
      
      packageJson.devDependencies['eslint'] = '^8.40.0';
      
      if (config.typescript) {
        packageJson.devDependencies['@typescript-eslint/eslint-plugin'] = '^5.59.2';
        packageJson.devDependencies['@typescript-eslint/parser'] = '^5.59.2';
      }
    }
    
    // Add Prettier dependencies
    if (config.prettier) {
      packageJson.scripts.format = 'prettier --write "**/*.{js,ts,json,md}"';
      
      packageJson.devDependencies['prettier'] = '^2.8.8';
    }
    
    // Add Jest dependencies
    if (config.jest) {
      packageJson.scripts.test = 'jest';
      
      packageJson.devDependencies['jest'] = '^29.5.0';
      
      if (config.typescript) {
        packageJson.devDependencies['ts-jest'] = '^29.1.0';
        packageJson.devDependencies['@types/jest'] = '^29.5.1';
      }
    }
    
    // Write package.json
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }
  
  /**
   * Create tsconfig.json file
   * @param projectDir Project directory
   */
  private async createTsConfig(projectDir: string): Promise<void> {
    const tsConfig = {
      compilerOptions: {
        target: 'es2022',
        module: 'commonjs',
        lib: ['es2022'],
        declaration: true,
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts'],
    };
    
    await fs.writeFile(
      path.join(projectDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }
  
  /**
   * Create README.md file
   * @param projectDir Project directory
   * @param config Project configuration
   */
  private async createReadme(projectDir: string, config: Partial<InitConfig>): Promise<void> {
    const readme = `# ${config.name}

${config.description}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

${config.typescript ? '## Build\n\n```bash\nnpm run build\n```\n\n' : ''}${
      config.eslint ? '## Lint\n\n```bash\nnpm run lint\n```\n\n' : ''
    }${config.prettier ? '## Format\n\n```bash\nnpm run format\n```\n\n' : ''}${
      config.jest ? '## Test\n\n```bash\nnpm run test\n```\n\n' : ''
    }## License

${config.license}
`;
    
    await fs.writeFile(path.join(projectDir, 'README.md'), readme);
  }
  
  /**
   * Create .gitignore file
   * @param projectDir Project directory
   */
  private async createGitignore(projectDir: string): Promise<void> {
    const gitignore = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Dependency directories
node_modules/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Build / generated output
dist/
build/
out/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
`;
    
    await fs.writeFile(path.join(projectDir, '.gitignore'), gitignore);
  }
  
  /**
   * Create ESLint configuration
   * @param projectDir Project directory
   * @param config Project configuration
   */
  private async createEslintConfig(projectDir: string, config: Partial<InitConfig>): Promise<void> {
    const eslintConfig: Record<string, any> = {
      env: {
        node: true,
        es2022: true,
      },
      extends: ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      rules: {
        'no-console': 'warn',
        'no-unused-vars': 'warn',
      },
    };
    
    // Add TypeScript configuration
    if (config.typescript) {
      eslintConfig.parser = '@typescript-eslint/parser';
      eslintConfig.plugins = ['@typescript-eslint'];
      eslintConfig.extends.push('plugin:@typescript-eslint/recommended');
      
      // Replace some rules
      eslintConfig.rules['no-unused-vars'] = 'off';
      eslintConfig.rules['@typescript-eslint/no-unused-vars'] = 'warn';
    }
    
    await fs.writeFile(
      path.join(projectDir, '.eslintrc.json'),
      JSON.stringify(eslintConfig, null, 2)
    );
  }
  
  /**
   * Create Prettier configuration
   * @param projectDir Project directory
   */
  private async createPrettierConfig(projectDir: string): Promise<void> {
    const prettierConfig = {
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: true,
      quoteProps: 'as-needed',
      trailingComma: 'es5',
      bracketSpacing: true,
      arrowParens: 'avoid',
    };
    
    await fs.writeFile(
      path.join(projectDir, '.prettierrc.json'),
      JSON.stringify(prettierConfig, null, 2)
    );
  }
  
  /**
   * Create sample code
   * @param projectDir Project directory
   * @param config Project configuration
   */
  private async createSampleCode(projectDir: string, config: Partial<InitConfig>): Promise<void> {
    // Create src directory
    const srcDir = path.join(projectDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    
    // Create index file
    const indexExtension = config.typescript ? 'ts' : 'js';
    let indexContent: string;
    
    if (config.typescript) {
      indexContent = `/**
 * ${config.name}
 * ${config.description}
 */

import { Agent } from 'metagpt-ts';

async function main() {
  console.log('Starting ${config.name}...');
  
  // Create a new agent
  const agent = new Agent({
    name: 'Assistant',
    systemPrompt: 'You are a helpful assistant.',
  });
  
  // Run the agent
  const response = await agent.run('Hello, what can you do?');
  
  console.log('Agent response:', response);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
`;
    } else {
      indexContent = `/**
 * ${config.name}
 * ${config.description}
 */

const { Agent } = require('metagpt-ts');

async function main() {
  console.log('Starting ${config.name}...');
  
  // Create a new agent
  const agent = new Agent({
    name: 'Assistant',
    systemPrompt: 'You are a helpful assistant.',
  });
  
  // Run the agent
  const response = await agent.run('Hello, what can you do?');
  
  console.log('Agent response:', response);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
`;
    }
    
    await fs.writeFile(path.join(srcDir, `index.${indexExtension}`), indexContent);
    
    // Create sample agent file
    if (config.typescript) {
      const agentContent = `/**
 * Sample agent implementation
 */

import { Agent, Message } from 'metagpt-ts';

export class CustomAgent extends Agent {
  constructor() {
    super({
      name: 'CustomAgent',
      systemPrompt: 'You are a specialized assistant that helps with coding tasks.',
    });
  }
  
  /**
   * Process a user message
   * @param message User message
   * @returns Agent response
   */
  async process(message: string): Promise<string> {
    // Create a message object
    const userMessage = new Message({
      role: 'user',
      content: message,
    });
    
    // Add message to memory
    this.memory.add(userMessage);
    
    // Generate response
    const response = await this.llm.chat([...this.memory.messages]);
    
    // Add response to memory
    this.memory.add(new Message({
      role: 'assistant',
      content: response,
    }));
    
    return response;
  }
}
`;
      
      await fs.writeFile(path.join(srcDir, 'custom-agent.ts'), agentContent);
    } else {
      const agentContent = `/**
 * Sample agent implementation
 */

const { Agent, Message } = require('metagpt-ts');

class CustomAgent extends Agent {
  constructor() {
    super({
      name: 'CustomAgent',
      systemPrompt: 'You are a specialized assistant that helps with coding tasks.',
    });
  }
  
  /**
   * Process a user message
   * @param {string} message User message
   * @returns {Promise<string>} Agent response
   */
  async process(message) {
    // Create a message object
    const userMessage = new Message({
      role: 'user',
      content: message,
    });
    
    // Add message to memory
    this.memory.add(userMessage);
    
    // Generate response
    const response = await this.llm.chat([...this.memory.messages]);
    
    // Add response to memory
    this.memory.add(new Message({
      role: 'assistant',
      content: response,
    }));
    
    return response;
  }
}

module.exports = { CustomAgent };
`;
      
      await fs.writeFile(path.join(srcDir, 'custom-agent.js'), agentContent);
    }
  }
  
  /**
   * Initialize Git repository
   * @param projectDir Project directory
   * @param context Command context
   */
  private async initGit(projectDir: string, context: CommandContext): Promise<void> {
    try {
      // Change to project directory
      const cwd = process.cwd();
      process.chdir(projectDir);
      
      // Initialize Git repository
      const { exec } = require('child_process');
      return new Promise((resolve, reject) => {
        exec('git init', (error: Error | null) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
          
          // Change back to original directory
          process.chdir(cwd);
        });
      });
    } catch (error) {
      context.output(`Failed to initialize Git repository: ${error}`, 'error');
      context.output('You can initialize it manually later.', 'info');
    }
  }
  
  /**
   * Show next steps
   * @param config Project configuration
   * @param context Command context
   */
  private showNextSteps(config: Partial<InitConfig>, context: CommandContext): void {
    context.output('Next steps:', 'info');
    context.output(`  cd ${config.name}`, 'info');
    context.output('  npm install', 'info');
    context.output('  npm start', 'info');
    
    context.output('\nHappy coding! 🚀', 'success');
  }
} 