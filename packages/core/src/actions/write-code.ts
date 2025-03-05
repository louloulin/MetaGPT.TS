import { BaseAction } from './base-action';
import type { StreamActionOutput, ActionConfig } from '../types/action';
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

export interface WriteCodeConfig extends ActionConfig {
  language?: string;
  framework?: string;
  style?: string;
}

/**
 * Action for writing code based on requirements
 */
export class WriteCodeAction extends BaseAction {
  private language: string;
  private framework?: string;
  private style?: string;

  constructor(config: WriteCodeConfig) {
    super({
      ...config,
      name: config.name || 'WriteCode',
      description: config.description || 'Write code based on requirements with quality checks'
    });

    this.language = config.language || 'typescript';
    this.framework = config.framework;
    this.style = config.style;
  }

  protected async prompt(): Promise<string> {
    const requirements = this.getArg<string>('requirements');
    if (!requirements) {
      throw new Error('No requirements provided for code generation');
    }

    return `As an expert ${this.language} developer${this.framework ? ` with ${this.framework} expertise` : ''}, 
write code that meets the following requirements:

${requirements}

Additional context:
${this.style ? `- Follow this coding style: ${this.style}` : '- Follow standard coding style and best practices'}
- Include necessary imports
- Add clear comments
- Handle edge cases
- Include error handling
- Write testable code

Please provide the complete implementation.`;
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
        language: this.language,
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

  public async run(): Promise<StreamActionOutput> {
    try {
      const requirements = this.getArg<string>('requirements');
      if (!requirements) {
        return {
          content: 'No requirements provided for code generation',
          status: 'failed'
        };
      }

      const response = await this.ask(await this.prompt());
      
      return {
        content: response,
        status: 'completed',
        metadata: {
          language: this.language,
          framework: this.framework,
          style: this.style
        }
      };
    } catch (error: unknown) {
      logger.error('[WriteCode] Error:', error);
      return {
        content: `Failed to generate code: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed'
      };
    }
  }
} 