import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * WriteCode Action
 * Generates code based on requirements and specifications
 */
export class WriteCode extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'WriteCode',
      description: config.description || 'Generates code based on requirements and specifications',
    });
  }

  /**
   * Run the action to generate code
   * @returns Action output containing the generated code
   */
  async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running WriteCode action`);
      
      // Get requirements from context
      const requirements = this.getArg<string>('requirements') || '';
      const language = this.getArg<string>('language') || 'typescript';
      const context = this.getArg<string>('context') || '';
      
      if (!requirements) {
        return this.createOutput(
          'No requirements provided. Please specify what code you need.',
          'failed'
        );
      }
      
      // Construct prompt for code generation
      const prompt = this.constructCodePrompt(requirements, language, context);
      
      // Generate code using LLM
      const generatedCode = await this.ask(prompt);
      
      // Extract code from LLM response (in case it includes explanations)
      const extractedCode = this.extractCodeFromResponse(generatedCode, language);
      
      return this.createOutput(
        extractedCode,
        'completed',
        { language, requirements }
      );
    } catch (error) {
      logger.error(`[${this.name}] Error generating code:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to generate code: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Construct a prompt for code generation
   * @param requirements - Requirements for the code
   * @param language - Programming language
   * @param context - Additional context
   * @returns Constructed prompt
   */
  private constructCodePrompt(requirements: string, language: string, context: string): string {
    return `
    You are an expert ${language} developer. Write clean, efficient, and well-documented code based on the following requirements:
    
    REQUIREMENTS:
    ${requirements}
    
    ${context ? `ADDITIONAL CONTEXT:\n${context}\n` : ''}
    
    Please provide only the ${language} code without explanations. The code should be complete, functional, and follow best practices.
    Include appropriate error handling, comments, and documentation.
    `;
  }

  /**
   * Extract code from LLM response
   * @param response - LLM response
   * @param language - Programming language
   * @returns Extracted code
   */
  private extractCodeFromResponse(response: string, language: string): string {
    // Try to extract code between markdown code blocks
    const codeBlockRegex = new RegExp(`\`\`\`(?:${language})?(.*?)\`\`\``, 'gs');
    const matches = response.match(codeBlockRegex);
    
    if (matches && matches.length > 0) {
      // Extract content from the first code block
      const codeBlock = matches[0];
      const code = codeBlock.replace(/```(?:\w+)?\n?/, '').replace(/```$/, '');
      return code.trim();
    }
    
    // If no code blocks found, return the entire response
    return response.trim();
  }
} 