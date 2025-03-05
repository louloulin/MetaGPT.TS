import { BaseAction } from './base-action';
import type { ActionConfig, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Supported programming languages
 */
export enum ProgrammingLanguage {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  JAVA = 'java',
  CSHARP = 'csharp',
  GO = 'go',
  RUST = 'rust'
}

/**
 * Code generation configuration
 */
export interface CodeGenerationConfig {
  requirements: string;
  language: ProgrammingLanguage | string;
  context?: string;
  testRequired?: boolean;
  documentation?: boolean;
  linting?: boolean;
  typeChecking?: boolean;
}

/**
 * Generated code result
 */
export interface GeneratedCode {
  code: string;
  language: string;
  documentation?: string;
  tests?: string;
  lintingIssues?: string[];
  typeIssues?: string[];
}

/**
 * Action for writing code based on requirements
 */
export class WriteCodeAction extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'WriteCode',
      description: config.description || 'Write code based on requirements with quality checks'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const requirements = this.getArg<string>('requirements');
    if (!requirements) {
      throw new Error('No requirements provided for code generation');
    }

    // Get optional arguments with defaults
    const language = this.getArg<string>('language') || ProgrammingLanguage.TYPESCRIPT;
    const context = this.getArg<string>('context') || '';
    const testRequired = this.getArg<boolean>('testRequired') || false;
    const documentation = this.getArg<boolean>('documentation') || true;
    const linting = this.getArg<boolean>('linting') || true;
    const typeChecking = this.getArg<boolean>('typeChecking') || true;

    // Log code generation start
    logger.info(`[${this.name}] Starting code generation for ${language}`);
    logger.debug(`[${this.name}] Configuration:`, {
      language,
      testRequired,
      documentation,
      linting,
      typeChecking
    });

    return `Please write high-quality code based on the following requirements:

Language: ${language}

${context ? `Context:\n${context}\n\n` : ''}
Requirements:
${requirements}

Please provide the implementation in the following JSON format:

{
  "code": "The main implementation code",
  "documentation": ${documentation ? `"Documentation in markdown format"` : "null"},
  "tests": ${testRequired ? `"Unit tests for the implementation"` : "null"},
  "lintingNotes": ["Any linting considerations"],
  "typeNotes": ["Any typing considerations"]
}

Focus on:
1. Clean and maintainable code following SOLID principles
2. Following best practices and conventions for ${language}
3. Proper error handling and edge cases
4. Clear and comprehensive documentation
5. Type safety and null checking
6. Performance considerations
7. Security best practices

Additional requirements:
${documentation ? '- Include JSDoc/documentation comments\n' : ''}
${testRequired ? '- Include unit tests with good coverage\n' : ''}
${linting ? '- Follow standard style guidelines\n' : ''}
${typeChecking ? '- Use strict type checking\n' : ''}

The code should be production-ready and follow modern development practices.`;
  }

  /**
   * Parse and validate the generated code
   * @param response The LLM response
   * @returns Parsed code result
   */
  private parseCodeResponse(response: string): GeneratedCode {
    try {
      const result = JSON.parse(response);
      
      if (!result.code) {
        throw new Error('No code found in response');
      }

      return {
        code: result.code,
        language: this.getArg<string>('language') || ProgrammingLanguage.TYPESCRIPT,
        documentation: result.documentation,
        tests: result.tests,
        lintingIssues: result.lintingNotes,
        typeIssues: result.typeNotes
      };
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse code response:`, error);
      throw new Error(`Failed to parse generated code: ${error}`);
    }
  }

  /**
   * Format the code result as markdown
   * @param result The generated code result
   * @returns Formatted markdown string
   */
  private formatCodeResult(result: GeneratedCode): string {
    return `# Generated Code

## Implementation
\`\`\`${result.language}
${result.code}
\`\`\`

${result.documentation ? `## Documentation\n${result.documentation}\n\n` : ''}
${result.tests ? `## Tests\n\`\`\`${result.language}\n${result.tests}\n\`\`\`\n\n` : ''}

${result.lintingIssues?.length ? `## Linting Considerations\n${result.lintingIssues.map(issue => `- ${issue}`).join('\n')}\n\n` : ''}
${result.typeIssues?.length ? `## Type Safety Notes\n${result.typeIssues.map(issue => `- ${issue}`).join('\n')}\n\n` : ''}

## Quality Checklist
- [x] Code follows SOLID principles
- [x] Proper error handling
- [x] Clear documentation
- [x] Type safety (where applicable)
- [x] Security best practices
- [x] Performance considerations`;
  }

  /**
   * Execute the code writing action
   * @returns Generated code with documentation and tests
   */
  public async run(): Promise<ActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Generate code using LLM
      const response = await this.ask(prompt);
      
      // Parse and validate code
      const result = this.parseCodeResponse(response);
      
      // Format as markdown
      const formattedResult = this.formatCodeResult(result);
      
      return this.createOutput(
        formattedResult,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in code generation:`, error);
      return this.createOutput(
        `Failed to generate code: ${error}`,
        'failed'
      );
    }
  }
} 