/**
 * @module CodeExecution
 * @category Environment
 * @description Provides a high-level service for executing code securely in various programming languages
 */

import { z } from 'zod';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Sandbox } from './sandbox';
import type { SandboxConfig, ExecutionResult, SupportedLanguage } from './sandbox';
import type { LLMProvider } from '../types/llm';

/**
 * Configuration for the code execution service
 */
export const CodeExecutionConfigSchema = z.object({
  /** Sandbox configuration */
  sandboxConfig: z.custom<SandboxConfig>().optional(),
  /** Default language to use when not specified */
  defaultLanguage: z.enum(['javascript', 'typescript', 'python', 'shell', 'ruby', 'go', 'java', 'csharp', 'php', 'rust']).default('javascript'),
  /** LLM provider for code analysis */
  llmProvider: z.any().optional(),
  /** Workspace directory for code files */
  workspaceDir: z.string().default(path.join(process.cwd(), '.code-workspace')),
  /** Whether to save execution history */
  saveHistory: z.boolean().default(true),
  /** Maximum history entries to keep */
  maxHistoryEntries: z.number().default(100),
  /** Whether to analyze code automatically */
  autoAnalyze: z.boolean().default(true),
  /** Whether to suggest fixes automatically */
  autoSuggestFixes: z.boolean().default(true)
});

export type CodeExecutionConfig = z.infer<typeof CodeExecutionConfigSchema>;

/**
 * Result of code analysis
 */
export interface CodeAnalysisResult {
  /** Quality score (0-10) */
  qualityScore: number;
  /** Issues found */
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    column?: number;
    code?: string;
  }>;
  /** Suggested improvements */
  suggestions: string[];
  /** Suggested code fixes */
  fixes?: Array<{
    description: string;
    originalCode: string;
    fixedCode: string;
    lineStart?: number;
    lineEnd?: number;
  }>;
}

/**
 * History entry for code execution
 */
export interface ExecutionHistoryEntry {
  /** Unique ID for the execution */
  id: string;
  /** Timestamp of execution */
  timestamp: number;
  /** Programming language */
  language: SupportedLanguage;
  /** Original code */
  code: string;
  /** Execution result */
  result: ExecutionResult;
  /** Analysis result if available */
  analysis?: CodeAnalysisResult;
}

/**
 * Service for executing code securely
 */
export class CodeExecutionService {
  /** Configuration */
  private config: CodeExecutionConfig;
  /** Sandbox instance */
  private sandbox: Sandbox;
  /** LLM provider for analysis */
  private llm: LLMProvider | null = null;
  /** Execution history */
  private history: ExecutionHistoryEntry[] = [];
  /** Session ID */
  private sessionId: string = new Date().toISOString().replace(/[:\.]/g, '-');

  /**
   * Create a new code execution service
   * @param config Configuration
   */
  constructor(config: Partial<CodeExecutionConfig> = {}) {
    this.config = CodeExecutionConfigSchema.parse(config);
    this.sandbox = new Sandbox(this.config.sandboxConfig);
    
    if (this.config.llmProvider) {
      this.llm = this.config.llmProvider as LLMProvider;
    }
    
    this.initWorkspace();
  }

  /**
   * Initialize the workspace
   */
  private async initWorkspace(): Promise<void> {
    try {
      await fs.mkdir(this.config.workspaceDir, { recursive: true });
      await fs.mkdir(path.join(this.config.workspaceDir, 'history'), { recursive: true });
      logger.info(`Code execution workspace initialized at ${this.config.workspaceDir}`);
    } catch (error) {
      logger.error('Failed to initialize code execution workspace:', error);
    }
  }

  /**
   * Execute code
   * @param code Code to execute
   * @param language Programming language
   * @param options Additional execution options
   * @returns Execution result
   */
  public async execute(
    code: string,
    language: SupportedLanguage = this.config.defaultLanguage as SupportedLanguage,
    options: {
      timeout?: number;
      stdin?: string;
      env?: Record<string, string>;
      args?: string[];
      files?: Array<{ path: string; content: string }>;
      analyze?: boolean;
      useDocker?: boolean;
    } = {}
  ): Promise<ExecutionResult & { analysis?: CodeAnalysisResult }> {
    try {
      logger.info(`Executing ${language} code...`);
      
      // Execute code in sandbox
      const result = await this.sandbox.execute({
        language,
        code,
        timeoutMs: options.timeout,
        stdin: options.stdin,
        env: options.env,
        args: options.args,
        files: options.files,
        useDocker: options.useDocker
      });
      
      // Create history entry
      const historyEntry: ExecutionHistoryEntry = {
        id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        language,
        code,
        result
      };
      
      // Analyze code if configured to do so
      const shouldAnalyze = options.analyze ?? this.config.autoAnalyze;
      if (shouldAnalyze && (result.exitCode !== 0 || this.config.autoSuggestFixes)) {
        const analysis = await this.analyzeCode(code, language, result);
        historyEntry.analysis = analysis;
        result.analysis = analysis;
      }
      
      // Add to history
      this.addToHistory(historyEntry);
      
      return result;
    } catch (error) {
      logger.error('Code execution failed:', error);
      return {
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        executionTimeMs: 0,
        memoryUsageMB: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create an interactive REPL session
   * @param language Programming language
   * @returns REPL interface
   */
  public createREPL(language: SupportedLanguage = this.config.defaultLanguage as SupportedLanguage) {
    return this.sandbox.createREPL(language);
  }

  /**
   * Analyze code and suggest improvements
   * @param code Code to analyze
   * @param language Programming language
   * @param executionResult Optional execution result for context
   * @returns Analysis result
   */
  public async analyzeCode(
    code: string,
    language: SupportedLanguage,
    executionResult?: ExecutionResult
  ): Promise<CodeAnalysisResult> {
    // Default analysis with basic insights
    const basicAnalysis: CodeAnalysisResult = {
      qualityScore: 5,
      issues: [],
      suggestions: []
    };
    
    // If we have execution results, extract issues from there
    if (executionResult?.analysis) {
      basicAnalysis.qualityScore = executionResult.analysis.qualityScore;
      basicAnalysis.issues = executionResult.analysis.issues.map(issue => ({
        ...issue,
        code: issue.line ? this.getCodeSnippet(code, issue.line) : undefined
      }));
      basicAnalysis.suggestions = executionResult.analysis.suggestions;
    }
    
    // If the code executed successfully but we still want to analyze for improvements
    if (executionResult?.exitCode === 0 && this.config.autoSuggestFixes) {
      basicAnalysis.suggestions.push('Code executed successfully.');
    }
    
    // If we have an LLM, use it for more advanced analysis
    if (this.llm) {
      try {
        const enhancedAnalysis = await this.analyzeLLM(code, language, executionResult);
        
        // Merge LLM analysis with basic analysis
        return {
          qualityScore: enhancedAnalysis.qualityScore,
          issues: [...basicAnalysis.issues, ...enhancedAnalysis.issues],
          suggestions: [...basicAnalysis.suggestions, ...enhancedAnalysis.suggestions],
          fixes: enhancedAnalysis.fixes
        };
      } catch (error) {
        logger.error('LLM analysis failed:', error);
        // Fall back to basic analysis
      }
    }
    
    return basicAnalysis;
  }

  /**
   * Use LLM to analyze code
   * @param code Code to analyze
   * @param language Programming language
   * @param executionResult Optional execution result for context
   * @returns Enhanced analysis from LLM
   */
  private async analyzeLLM(
    code: string,
    language: SupportedLanguage,
    executionResult?: ExecutionResult
  ): Promise<CodeAnalysisResult> {
    if (!this.llm) {
      throw new Error('No LLM provider available for analysis');
    }
    
    const prompt = `
You are a code review expert. Analyze the following ${language} code and provide a detailed review. 
${executionResult?.exitCode !== 0 ? 'The code failed to execute correctly.' : 'The code executed successfully.'}

${executionResult?.stderr ? `Here is the error output:\n${executionResult.stderr}\n` : ''}
${executionResult?.stdout ? `Here is the standard output:\n${executionResult.stdout}\n` : ''}

CODE:
\`\`\`${language}
${code}
\`\`\`

Provide your analysis in the following JSON format:
{
  "qualityScore": <number between 0-10>,
  "issues": [
    {
      "type": "<error|warning|info>",
      "message": "<issue description>",
      "line": <line number if applicable>,
      "column": <column number if applicable>
    }
  ],
  "suggestions": [
    "<suggestion 1>",
    "<suggestion 2>"
  ],
  "fixes": [
    {
      "description": "<description of the fix>",
      "originalCode": "<code snippet with issue>",
      "fixedCode": "<corrected code>",
      "lineStart": <starting line number>,
      "lineEnd": <ending line number>
    }
  ]
}
`;
    
    try {
      const response = await this.llm.generate(prompt, {});
      const analysis = JSON.parse(response);
      
      // Validate and sanitize the LLM response
      return {
        qualityScore: typeof analysis.qualityScore === 'number' ? 
          Math.min(10, Math.max(0, analysis.qualityScore)) : 5,
        issues: Array.isArray(analysis.issues) ? analysis.issues : [],
        suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
        fixes: Array.isArray(analysis.fixes) ? analysis.fixes : []
      };
    } catch (error) {
      logger.error('Failed to parse LLM analysis:', error);
      
      // Return a fallback analysis
      return {
        qualityScore: 5,
        issues: [{
          type: 'info',
          message: 'Code analysis using AI failed. Check logs for details.'
        }],
        suggestions: ['Try running the code analysis again.'],
        fixes: []
      };
    }
  }

  /**
   * Apply suggested fixes to code
   * @param code Original code
   * @param fixes Fixes to apply
   * @returns Updated code with fixes applied
   */
  public applyFixes(code: string, fixes: CodeAnalysisResult['fixes'] = []): string {
    if (!fixes || fixes.length === 0) {
      return code;
    }
    
    // Split code into lines for line-by-line replacement
    const lines = code.split('\n');
    
    // Sort fixes by line number in descending order to avoid index shifting
    const sortedFixes = [...fixes].sort((a, b) => {
      const lineStartA = a.lineStart ?? 0;
      const lineStartB = b.lineStart ?? 0;
      return lineStartB - lineStartA;
    });
    
    // Apply each fix
    for (const fix of sortedFixes) {
      if (fix.lineStart && fix.lineEnd && fix.fixedCode) {
        // Convert to 0-indexed
        const startIdx = Math.max(0, fix.lineStart - 1);
        const endIdx = Math.min(lines.length, fix.lineEnd);
        
        // Calculate the number of lines to replace
        const numLines = endIdx - startIdx;
        
        // Split fixed code into lines
        const fixedLines = fix.fixedCode.split('\n');
        
        // Replace the lines in the original code
        lines.splice(startIdx, numLines, ...fixedLines);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Get a code snippet around a specific line
   * @param code Full code
   * @param lineNumber Line number (1-indexed)
   * @param contextLines Number of context lines to include
   * @returns Code snippet with line numbers
   */
  private getCodeSnippet(
    code: string,
    lineNumber: number,
    contextLines: number = 2
  ): string {
    const lines = code.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);
    
    return lines.slice(start, end).map((line, i) => {
      const num = start + i + 1;
      return `${num === lineNumber ? '>' : ' '} ${num}: ${line}`;
    }).join('\n');
  }

  /**
   * Add an entry to the execution history
   * @param entry History entry
   */
  private addToHistory(entry: ExecutionHistoryEntry): void {
    this.history.unshift(entry);
    
    // Trim history to max size
    if (this.history.length > this.config.maxHistoryEntries) {
      this.history = this.history.slice(0, this.config.maxHistoryEntries);
    }
    
    // Save history if enabled
    if (this.config.saveHistory) {
      this.saveHistoryEntry(entry).catch(error => {
        logger.error('Failed to save execution history:', error);
      });
    }
  }

  /**
   * Save a history entry to disk
   * @param entry History entry
   */
  private async saveHistoryEntry(entry: ExecutionHistoryEntry): Promise<void> {
    const historyDir = path.join(this.config.workspaceDir, 'history', this.sessionId);
    await fs.mkdir(historyDir, { recursive: true });
    
    const filePath = path.join(historyDir, `${entry.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  /**
   * Get execution history
   * @param limit Maximum number of entries to retrieve
   * @returns Execution history entries
   */
  public getHistory(limit: number = this.config.maxHistoryEntries): ExecutionHistoryEntry[] {
    return this.history.slice(0, limit);
  }

  /**
   * Clear execution history
   */
  public clearHistory(): void {
    this.history = [];
  }

  /**
   * Save code to a file in the workspace
   * @param fileName File name
   * @param code Code to save
   * @param language Programming language (for file extension)
   * @returns Path to the saved file
   */
  public async saveCodeToFile(
    fileName: string,
    code: string,
    language: SupportedLanguage = this.config.defaultLanguage as SupportedLanguage
  ): Promise<string> {
    // Ensure file has the correct extension
    const extension = fileName.includes('.') ? '' : `.${language}`;
    const filePath = path.join(this.config.workspaceDir, `${fileName}${extension}`);
    
    // Create directory if needed
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Save file
    await fs.writeFile(filePath, code, 'utf-8');
    logger.info(`Saved code to ${filePath}`);
    
    return filePath;
  }

  /**
   * Load code from a file in the workspace
   * @param fileName File name or path
   * @returns Code content
   */
  public async loadCodeFromFile(fileName: string): Promise<string> {
    let filePath = fileName;
    if (!path.isAbsolute(fileName)) {
      filePath = path.join(this.config.workspaceDir, fileName);
    }
    
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to load code from ${filePath}:`, error);
      throw new Error(`Cannot load code from ${fileName}: ${error}`);
    }
  }

  /**
   * Run a performance test on code
   * @param code Code to test
   * @param language Programming language
   * @param iterations Number of iterations
   * @returns Performance test results
   */
  public async runPerformanceTest(
    code: string,
    language: SupportedLanguage = this.config.defaultLanguage as SupportedLanguage,
    iterations: number = 5
  ): Promise<{
    averageTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    iterations: Array<{ timeMs: number; memoryMB: number }>;
  }> {
    const results = [];
    
    logger.info(`Running performance test (${iterations} iterations)`);
    
    for (let i = 0; i < iterations; i++) {
      const result = await this.sandbox.execute({
        language,
        code
      });
      
      results.push({
        timeMs: result.executionTimeMs,
        memoryMB: result.memoryUsageMB
      });
    }
    
    // Calculate statistics
    const times = results.map(r => r.timeMs);
    const averageTimeMs = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTimeMs = Math.min(...times);
    const maxTimeMs = Math.max(...times);
    
    return {
      averageTimeMs,
      minTimeMs,
      maxTimeMs,
      iterations: results
    };
  }

  /**
   * Set the LLM provider for code analysis
   * @param provider LLM provider
   */
  public setLLMProvider(provider: LLMProvider): void {
    this.llm = provider;
  }
} 