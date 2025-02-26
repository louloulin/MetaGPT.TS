/**
 * DebugError Action
 * 
 * This action analyzes code errors, generates solutions, validates fixes,
 * performs root cause analysis, and provides debugging steps documentation.
 */

import { BaseAction } from './base-action';
import type { Message } from '../types/message';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';
import { RunCode, ProgrammingLanguage, type ExecutionResult } from './run-code';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',   // Errors that completely break the application
  MAJOR = 'MAJOR',         // Significant errors that affect functionality
  MINOR = 'MINOR',         // Minor errors with limited impact
  WARNING = 'WARNING',     // Issues that might cause problems
  INFO = 'INFO'            // Informational messages about potential improvements
}

/**
 * Error type categories
 */
export enum ErrorType {
  SYNTAX = 'SYNTAX',               // Syntax errors
  RUNTIME = 'RUNTIME',             // Runtime errors
  LOGICAL = 'LOGICAL',             // Logical errors
  TYPE = 'TYPE',                   // Type errors
  REFERENCE = 'REFERENCE',         // Reference errors
  DEPENDENCY = 'DEPENDENCY',       // Missing or incompatible dependencies
  PERFORMANCE = 'PERFORMANCE',     // Performance issues
  MEMORY = 'MEMORY',               // Memory leaks or excessive memory usage
  SECURITY = 'SECURITY',           // Security vulnerabilities
  COMPATIBILITY = 'COMPATIBILITY', // Browser/environment compatibility issues
  NETWORK = 'NETWORK',             // Network-related errors
  IO = 'IO',                       // Input/output errors
  OTHER = 'OTHER'                  // Other types of errors
}

/**
 * Structure for a debugging step
 */
export interface DebuggingStep {
  order: number;
  description: string;
  code?: string;
  expected_outcome: string;
}

/**
 * Structure for a code fix suggestion
 */
export interface FixSuggestion {
  description: string;
  code: string;
  explanation: string;
  confidence: number; // 0-1 confidence score
}

/**
 * Structure for debugging result
 */
export interface DebuggingResult {
  error_analysis: {
    error_message: string;
    error_type: ErrorType;
    severity: ErrorSeverity;
    line_number?: number;
    column_number?: number;
    file_path?: string;
  };
  root_cause: {
    description: string;
    technical_explanation: string;
  };
  solutions: FixSuggestion[];
  debugging_steps: DebuggingStep[];
  validation: {
    fixed: boolean;
    execution_result?: ExecutionResult;
    remaining_issues?: string[];
  };
  resources?: {
    documentation_links: string[];
    related_stack_overflow_questions?: string[];
  };
}

/**
 * Debug configuration
 */
export interface DebugConfig {
  code: string;
  language: ProgrammingLanguage | string;
  error_message?: string;
  file_path?: string;
  auto_fix?: boolean;
  validate_fix?: boolean;
  max_solutions?: number;
}

/**
 * Action for debugging code errors
 */
export class DebugError extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'DebugError',
      description: config.description || 'Analyzes code errors, generates solutions, validates fixes, and provides debugging documentation',
    });
  }

  /**
   * Runs the DebugError action
   * @returns The debugging results
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running DebugError action`);
      
      // Get debug configuration from context
      const code = this.getArg<string>('code');
      const language = this.getArg<string>('language') || ProgrammingLanguage.JAVASCRIPT;
      const errorMessage = this.getArg<string>('error_message');
      const filePath = this.getArg<string>('file_path');
      const autoFix = this.getArg<boolean>('auto_fix') || false;
      const validateFix = this.getArg<boolean>('validate_fix') || true;
      const maxSolutions = this.getArg<number>('max_solutions') || 3;
      
      // Validate code input
      if (!code) {
        return this.createOutput(
          'No code provided for debugging. Please provide the code to debug.',
          'failed'
        );
      }

      // If no error message was provided, try to execute the code to get the error
      let detectedError: string | undefined = errorMessage;
      let executionResult: ExecutionResult | undefined;
      
      if (!detectedError) {
        logger.info(`[${this.name}] No error message provided, executing code to detect errors`);
        executionResult = await this.executeCode(code, language);
        
        if (!executionResult.success) {
          detectedError = executionResult.stderr || executionResult.error;
          logger.info(`[${this.name}] Detected error: ${detectedError}`);
        } else {
          logger.info(`[${this.name}] No errors detected in code execution`);
        }
      }

      // If still no error detected and no message provided, can't proceed
      if (!detectedError && !errorMessage) {
        return this.createOutput(
          'No errors detected in code execution and no error message provided. Cannot proceed with debugging.',
          'completed',
          { execution_result: executionResult }
        );
      }

      // Analyze error and generate debug results
      const debuggingResult = await this.analyzeError({
        code,
        language,
        error_message: detectedError || 'Unknown error',
        file_path: filePath,
        auto_fix: autoFix,
        validate_fix: validateFix,
        max_solutions: maxSolutions
      });

      // If auto-fix is enabled and there are solutions
      if (autoFix && debuggingResult.solutions.length > 0) {
        // Choose the highest confidence solution
        const bestSolution = debuggingResult.solutions.reduce(
          (best, current) => current.confidence > best.confidence ? current : best,
          debuggingResult.solutions[0]
        );
        
        logger.info(`[${this.name}] Auto-fixing with solution: ${bestSolution.description}`);
        const fixedCode = bestSolution.code;
        
        // Validate the fix if requested
        if (validateFix) {
          const validationResult = await this.executeCode(fixedCode, language);
          
          debuggingResult.validation = {
            fixed: validationResult.success,
            execution_result: validationResult,
            remaining_issues: validationResult.success ? [] : [validationResult.stderr || validationResult.error || 'Unknown issue']
          };
        }
      }

      // Generate output
      const formattedResult = this.formatDebuggingResult(debuggingResult);
      
      return this.createOutput(
        formattedResult,
        'completed',
        debuggingResult
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in DebugError action:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to debug code: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Executes code to detect errors
   * @param code Code to execute
   * @param language Programming language
   * @returns Execution result
   */
  private async executeCode(code: string, language: string): Promise<ExecutionResult> {
    // Create RunCode action instance
    const runCode = new RunCode({
      name: 'RunCode',
      llm: this.llm,
      args: {
        code,
        language,
        timeout: 10000, // 10 seconds timeout
      }
    });
    
    // Run the action
    const result = await runCode.run();
    
    // Extract execution result from action output
    return result.instructContent as ExecutionResult;
  }

  /**
   * Analyzes errors and generates debug results
   * @param config Debug configuration
   * @returns Debugging result
   */
  private async analyzeError(config: DebugConfig): Promise<DebuggingResult> {
    const { code, language, error_message, file_path, max_solutions } = config;
    
    // Construct prompt for error analysis
    const prompt = `
    I need help debugging the following ${language} code that has an error:
    
    ${file_path ? `File: ${file_path}` : ''}
    
    \`\`\`${language}
    ${code}
    \`\`\`
    
    Error message:
    \`\`\`
    ${error_message}
    \`\`\`
    
    Please analyze this error and provide a detailed debugging result as a valid JSON object with the following structure:
    
    {
      "error_analysis": {
        "error_message": "The exact error message",
        "error_type": "One of: SYNTAX, RUNTIME, LOGICAL, TYPE, REFERENCE, DEPENDENCY, PERFORMANCE, MEMORY, SECURITY, COMPATIBILITY, NETWORK, IO, OTHER",
        "severity": "One of: CRITICAL, MAJOR, MINOR, WARNING, INFO",
        "line_number": optional line number where the error occurs,
        "column_number": optional column number where the error occurs,
        "file_path": optional file path of the error
      },
      "root_cause": {
        "description": "Brief description of the root cause",
        "technical_explanation": "Detailed technical explanation of why this error occurs"
      },
      "solutions": [
        {
          "description": "Brief description of the solution",
          "code": "The corrected code (provide the complete fixed code, not just the changed lines)",
          "explanation": "Explanation of why this solution works",
          "confidence": confidence score from 0-1 on how likely this solution will work
        }
      ],
      "debugging_steps": [
        {
          "order": 1,
          "description": "Step description",
          "code": "Optional code to try for this step",
          "expected_outcome": "What to expect if this step is successful"
        }
      ],
      "resources": {
        "documentation_links": ["Relevant documentation links"],
        "related_stack_overflow_questions": ["Optional links to related Stack Overflow questions"]
      }
    }
    
    Please provide up to ${max_solutions} different solution approaches if possible, from most to least recommended.
    Make sure the solution code is complete, correct, and properly handles the error.
    Focus on providing practical debugging steps that would help identify the issue.
    `;
    
    // Get LLM response
    const response = await this.ask(prompt);
    
    try {
      // Parse the JSON response
      const debugResult = JSON.parse(response) as DebuggingResult;
      
      // Initialize validation field if not present
      if (!debugResult.validation) {
        debugResult.validation = {
          fixed: false
        };
      }
      
      return debugResult;
    } catch (error) {
      logger.error('Failed to parse LLM response as JSON', error);
      // Create fallback debugging result
      return this.createFallbackDebuggingResult(code, language, error_message);
    }
  }

  /**
   * Creates a fallback debugging result when parsing fails
   * @param code Original code
   * @param language Programming language
   * @param errorMessage Error message
   * @returns Fallback debugging result
   */
  private createFallbackDebuggingResult(code: string, language: string, errorMessage: string | undefined): DebuggingResult {
    return {
      error_analysis: {
        error_message: errorMessage || 'Unknown error',
        error_type: ErrorType.OTHER,
        severity: ErrorSeverity.MAJOR,
      },
      root_cause: {
        description: 'Unable to determine root cause',
        technical_explanation: 'Error analysis failed to parse the LLM response'
      },
      solutions: [{
        description: 'Review the code manually',
        code: code,
        explanation: 'The automatic error analysis failed. Please review the code manually.',
        confidence: 0.1
      }],
      debugging_steps: [{
        order: 1,
        description: 'Run the code with verbose error reporting enabled',
        expected_outcome: 'More detailed error information'
      }],
      validation: {
        fixed: false
      },
      resources: {
        documentation_links: [
          `https://developer.mozilla.org/en-US/docs/Web/${language}`,
          `https://stackoverflow.com/questions/tagged/${language}`
        ]
      }
    };
  }

  /**
   * Formats debugging result into human-readable markdown
   * @param result Debugging result
   * @returns Formatted markdown string
   */
  private formatDebuggingResult(result: DebuggingResult): string {
    let markdown = `# Debugging Report\n\n`;
    
    // Format error analysis section
    markdown += `## Error Analysis\n\n`;
    markdown += `- **Error Message**: \`${result.error_analysis.error_message}\`\n`;
    markdown += `- **Error Type**: ${result.error_analysis.error_type}\n`;
    markdown += `- **Severity**: ${result.error_analysis.severity}\n`;
    
    if (result.error_analysis.line_number) {
      markdown += `- **Location**: Line ${result.error_analysis.line_number}`;
      
      if (result.error_analysis.column_number) {
        markdown += `, Column ${result.error_analysis.column_number}`;
      }
      
      if (result.error_analysis.file_path) {
        markdown += ` in \`${result.error_analysis.file_path}\``;
      }
      
      markdown += '\n';
    }
    
    markdown += '\n';
    
    // Format root cause section
    markdown += `## Root Cause\n\n`;
    markdown += `${result.root_cause.description}\n\n`;
    markdown += `${result.root_cause.technical_explanation}\n\n`;
    
    // Format solutions section
    markdown += `## Suggested Solutions\n\n`;
    
    if (result.solutions.length === 0) {
      markdown += `No solutions found.\n\n`;
    } else {
      result.solutions.forEach((solution, index) => {
        markdown += `### Solution ${index + 1}: ${solution.description}\n\n`;
        markdown += `**Confidence**: ${Math.round(solution.confidence * 100)}%\n\n`;
        markdown += `**Explanation**: ${solution.explanation}\n\n`;
        markdown += `**Fixed Code**:\n\n\`\`\`\n${solution.code}\n\`\`\`\n\n`;
      });
    }
    
    // Format debugging steps section
    markdown += `## Debugging Steps\n\n`;
    
    if (result.debugging_steps.length === 0) {
      markdown += `No debugging steps provided.\n\n`;
    } else {
      result.debugging_steps.sort((a, b) => a.order - b.order)
        .forEach(step => {
          markdown += `### Step ${step.order}: ${step.description}\n\n`;
          
          if (step.code) {
            markdown += `**Try This**:\n\n\`\`\`\n${step.code}\n\`\`\`\n\n`;
          }
          
          markdown += `**Expected Outcome**: ${step.expected_outcome}\n\n`;
        });
    }
    
    // Format validation section
    if (result.validation) {
      markdown += `## Validation Results\n\n`;
      
      if (result.validation.fixed) {
        markdown += `✅ **The issue has been fixed!**\n\n`;
      } else {
        markdown += `❌ **The issue is not yet resolved.**\n\n`;
      }
      
      if (result.validation.execution_result) {
        const exec = result.validation.execution_result;
        
        markdown += `**Execution Details**:\n`;
        markdown += `- **Exit Code**: ${exec.exitCode}\n`;
        markdown += `- **Execution Time**: ${exec.executionTime / 1000}s\n\n`;
        
        if (exec.stdout && exec.stdout.trim()) {
          markdown += `**Output**:\n\`\`\`\n${exec.stdout.trim()}\n\`\`\`\n\n`;
        }
        
        if (exec.stderr && exec.stderr.trim()) {
          markdown += `**Error Output**:\n\`\`\`\n${exec.stderr.trim()}\n\`\`\`\n\n`;
        }
      }
      
      if (result.validation.remaining_issues && result.validation.remaining_issues.length > 0) {
        markdown += `**Remaining Issues**:\n\n`;
        result.validation.remaining_issues.forEach(issue => {
          markdown += `- ${issue}\n`;
        });
        markdown += '\n';
      }
    }
    
    // Format resources section
    if (result.resources) {
      markdown += `## Additional Resources\n\n`;
      
      if (result.resources.documentation_links.length > 0) {
        markdown += `**Documentation**:\n\n`;
        result.resources.documentation_links.forEach(link => {
          markdown += `- [${link.split('/').pop() || link}](${link})\n`;
        });
        markdown += '\n';
      }
      
      if (result.resources.related_stack_overflow_questions && result.resources.related_stack_overflow_questions.length > 0) {
        markdown += `**Related Stack Overflow Questions**:\n\n`;
        result.resources.related_stack_overflow_questions.forEach(link => {
          const title = link.split('/').pop()?.replace(/-/g, ' ') || link;
          markdown += `- [${title}](${link})\n`;
        });
        markdown += '\n';
      }
    }
    
    return markdown;
  }
} 