import { BaseAction } from './base-action';
import type { StreamActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Debug severity levels
 */
export enum DebugSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Debug issue type
 */
export interface DebugIssue {
  id: string;
  title: string;
  description: string;
  severity: DebugSeverity;
  location?: {
    file: string;
    startLine: number;
    endLine?: number;
    column?: number;
  };
  codeSnippet?: string;
  stackTrace?: string[];
  relatedIssues?: string[];
}

/**
 * Debug step type
 */
export interface DebugStep {
  id: string;
  description: string;
  expectedOutcome: string;
  variables: {
    name: string;
    type: string;
    expectedValue?: string;
    watchCondition?: string;
  }[];
  breakpoints?: {
    file: string;
    line: number;
    condition?: string;
  }[];
  commands?: string[];
}

/**
 * Code fix type
 */
export interface CodeFix {
  id: string;
  title: string;
  description: string;
  changes: {
    file: string;
    originalCode: string;
    fixedCode: string;
    explanation: string;
  }[];
  sideEffects?: string[];
  alternatives?: {
    description: string;
    tradeoffs: string[];
  }[];
}

/**
 * Test case type
 */
export interface TestCase {
  id: string;
  description: string;
  input: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  setup?: string[];
  cleanup?: string[];
  assertions: string[];
}

/**
 * Debug result type
 */
export interface DebugResult {
  summary: {
    totalIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
  };
  issues: DebugIssue[];
  analysis: {
    rootCause: string;
    impactAnalysis: string[];
    riskAssessment: string[];
  };
  debugSteps: DebugStep[];
  fixes: CodeFix[];
  verification: {
    testCases: TestCase[];
    regressionAreas: string[];
    postDeploymentMonitoring: string[];
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export interface DebugCodeConfig extends ActionConfig {
  language?: string;
  testFramework?: string;
  debugLevel?: 'basic' | 'advanced' | 'comprehensive';
}

/**
 * Action for debugging code and fixing issues
 */
export class DebugCode extends BaseAction {
  private language: string;
  private testFramework?: string;
  private debugLevel: 'basic' | 'advanced' | 'comprehensive';

  constructor(config: DebugCodeConfig) {
    super({
      ...config,
      name: config.name || 'DebugCode',
      description: config.description || 'Debug code and provide fixes for issues'
    });

    this.language = config.language || 'typescript';
    this.testFramework = config.testFramework;
    this.debugLevel = config.debugLevel || 'comprehensive';
  }

  protected async prompt(): Promise<string> {
    const code = this.getArg<string>('code');
    const error = this.getArg<string>('error');
    const context = this.getArg<string>('context') || '';

    if (!code) {
      throw new Error('No code provided for debugging');
    }

    return `As an expert ${this.language} developer, analyze and debug the following code:

${context ? `Context:\n${context}\n\n` : ''}
Code:
${code}

${error ? `Error encountered:\n${error}\n\n` : ''}

Debug Level: ${this.debugLevel}
${this.testFramework ? `Test Framework: ${this.testFramework}` : ''}

Please provide:
1. Issue analysis
2. Root cause identification
3. Proposed fixes
4. Prevention recommendations
5. ${this.debugLevel === 'comprehensive' ? 'Test cases to verify the fix' : 'Basic verification steps'}

Focus on:
- Code quality and best practices
- Error handling
- Edge cases
- Performance implications
- Security considerations`;
  }

  public async run(): Promise<StreamActionOutput> {
    try {
      const code = this.getArg<string>('code');
      if (!code) {
        return {
          content: 'No code provided for debugging',
          status: 'failed'
        };
      }

      const response = await this.ask(await this.prompt());
      
      return {
        content: response,
        status: 'completed',
        metadata: {
          language: this.language,
          testFramework: this.testFramework,
          debugLevel: this.debugLevel
        }
      };
    } catch (error: unknown) {
      logger.error('[DebugCode] Error:', error);
      return {
        content: `Failed to debug code: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed'
      };
    }
  }
} 