import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
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

/**
 * Action for debugging code and fixing issues
 */
export class DebugCode extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'DebugCode',
      description: config.description || 'Debug code and provide fixes for issues'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const code = this.getArg<string>('code');
    if (!code) {
      throw new Error('No code provided for debugging');
    }

    // Get optional arguments with defaults
    const error = this.getArg<string>('error') || '';
    const language = this.getArg<string>('language') || 'TypeScript';
    const context = this.getArg<string>('context') || '';
    const stackTrace = this.getArg<string[]>('stackTrace') || [];
    const testResults = this.getArg<string>('testResults') || '';
    const performance = this.getArg<Record<string, number>>('performance') || {};

    // Log debug start
    logger.info(`[${this.name}] Starting code debugging`);
    logger.debug(`[${this.name}] Configuration:`, {
      language,
      hasError: !!error,
      hasContext: !!context,
      hasStackTrace: stackTrace.length > 0,
      hasTestResults: !!testResults,
      hasPerformance: Object.keys(performance).length > 0
    });

    return `Debug the following ${language} code and provide a comprehensive analysis:

${context ? `Context:
${context}

` : ''}Code:
${code}

${error ? `Error:
${error}

` : ''}${stackTrace.length ? `Stack Trace:
${stackTrace.join('\n')}

` : ''}${testResults ? `Test Results:
${testResults}

` : ''}${Object.keys(performance).length ? `Performance Metrics:
${Object.entries(performance).map(([key, value]) => `${key}: ${value}`).join('\n')}

` : ''}Please provide the debug analysis in the following JSON format:

{
  "summary": {
    "totalIssues": 0,
    "criticalCount": 0,
    "highCount": 0,
    "mediumCount": 0,
    "lowCount": 0,
    "infoCount": 0
  },
  "issues": [
    {
      "id": "Unique issue ID",
      "title": "Issue title",
      "description": "Detailed description",
      "severity": "${Object.values(DebugSeverity).join('" | "')}",
      "location": {
        "file": "File path",
        "startLine": 0,
        "endLine": 0,
        "column": 0
      },
      "codeSnippet": "Relevant code",
      "stackTrace": ["Stack trace lines"],
      "relatedIssues": ["Related issue IDs"]
    }
  ],
  "analysis": {
    "rootCause": "Root cause description",
    "impactAnalysis": ["Impact descriptions"],
    "riskAssessment": ["Risk descriptions"]
  },
  "debugSteps": [
    {
      "id": "Step ID",
      "description": "Step description",
      "expectedOutcome": "Expected outcome",
      "variables": [
        {
          "name": "Variable name",
          "type": "Variable type",
          "expectedValue": "Expected value",
          "watchCondition": "Watch condition"
        }
      ],
      "breakpoints": [
        {
          "file": "File path",
          "line": 0,
          "condition": "Break condition"
        }
      ],
      "commands": ["Debug commands"]
    }
  ],
  "fixes": [
    {
      "id": "Fix ID",
      "title": "Fix title",
      "description": "Fix description",
      "changes": [
        {
          "file": "File path",
          "originalCode": "Original code",
          "fixedCode": "Fixed code",
          "explanation": "Change explanation"
        }
      ],
      "sideEffects": ["Potential side effects"],
      "alternatives": [
        {
          "description": "Alternative approach",
          "tradeoffs": ["Tradeoff descriptions"]
        }
      ]
    }
  ],
  "verification": {
    "testCases": [
      {
        "id": "Test ID",
        "description": "Test description",
        "input": {
          "param": "value"
        },
        "expectedOutput": {
          "field": "value"
        },
        "setup": ["Setup steps"],
        "cleanup": ["Cleanup steps"],
        "assertions": ["Assertion statements"]
      }
    ],
    "regressionAreas": ["Areas to check for regression"],
    "postDeploymentMonitoring": ["Monitoring points"]
  },
  "recommendations": {
    "immediate": ["Immediate actions"],
    "shortTerm": ["Short-term improvements"],
    "longTerm": ["Long-term improvements"]
  }
}

Please ensure:
1. All issues are properly categorized by severity
2. Debug steps are clear and actionable
3. Code fixes include proper explanations
4. Test cases cover edge cases
5. Recommendations are practical and prioritized`;
  }

  /**
   * Parse and validate the debug result
   * @param response The LLM response
   * @returns Parsed debug result
   */
  private parseDebugResult(response: string): DebugResult {
    try {
      const result = JSON.parse(response);
      
      // Validate required sections
      if (!result.summary || !result.issues || !result.analysis || 
          !result.debugSteps || !result.fixes || !result.verification || 
          !result.recommendations) {
        throw new Error('Missing required sections in debug result');
      }

      // Validate summary counts
      const summary = result.summary;
      if (summary.totalIssues !== result.issues.length ||
          summary.totalIssues !== (
            summary.criticalCount +
            summary.highCount +
            summary.mediumCount +
            summary.lowCount +
            summary.infoCount
          )) {
        throw new Error('Issue count mismatch in summary');
      }

      return result;
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse debug result:`, error);
      throw new Error(`Failed to parse debug result: ${error}`);
    }
  }

  /**
   * Format the debug result as markdown
   * @param result The debug result
   * @returns Formatted markdown string
   */
  private formatDebugResult(result: DebugResult): string {
    return `# Code Debug Report

## Summary
- Total Issues: ${result.summary.totalIssues}
- Critical: ${result.summary.criticalCount}
- High: ${result.summary.highCount}
- Medium: ${result.summary.mediumCount}
- Low: ${result.summary.lowCount}
- Info: ${result.summary.infoCount}

## Issues Found
${result.issues.map(issue => `
### ${issue.title} (${issue.severity})
${issue.description}

${issue.location ? `**Location:** ${issue.location.file}:${issue.location.startLine}${issue.location.endLine ? `-${issue.location.endLine}` : ''}${issue.location.column ? `:${issue.location.column}` : ''}` : ''}

${issue.codeSnippet ? `**Relevant Code:**
\`\`\`
${issue.codeSnippet}
\`\`\`
` : ''}

${issue.stackTrace?.length ? `**Stack Trace:**
\`\`\`
${issue.stackTrace.join('\n')}
\`\`\`
` : ''}

${issue.relatedIssues?.length ? `**Related Issues:** ${issue.relatedIssues.join(', ')}` : ''}`).join('\n')}

## Root Cause Analysis
${result.analysis.rootCause}

### Impact Analysis
${result.analysis.impactAnalysis.map(impact => `- ${impact}`).join('\n')}

### Risk Assessment
${result.analysis.riskAssessment.map(risk => `- ${risk}`).join('\n')}

## Debug Steps
${result.debugSteps.map(step => `
### ${step.id}. ${step.description}
Expected Outcome: ${step.expectedOutcome}

**Variables to Watch:**
${step.variables.map(v => `- \`${v.name}\` (${v.type})${v.expectedValue ? `: Expected ${v.expectedValue}` : ''}${v.watchCondition ? `\n  Watch when: ${v.watchCondition}` : ''}`).join('\n')}

${step.breakpoints?.length ? `**Breakpoints:**
${step.breakpoints.map(b => `- ${b.file}:${b.line}${b.condition ? ` when ${b.condition}` : ''}`).join('\n')}` : ''}

${step.commands?.length ? `**Debug Commands:**
\`\`\`
${step.commands.join('\n')}
\`\`\`
` : ''}`).join('\n')}

## Proposed Fixes
${result.fixes.map(fix => `
### ${fix.title}
${fix.description}

**Changes Required:**
${fix.changes.map(change => `
#### In ${change.file}:
\`\`\`diff
- ${change.originalCode}
+ ${change.fixedCode}
\`\`\`
${change.explanation}`).join('\n')}

${fix.sideEffects?.length ? `**Potential Side Effects:**
${fix.sideEffects.map(effect => `- ${effect}`).join('\n')}` : ''}

${fix.alternatives?.length ? `**Alternative Approaches:**
${fix.alternatives.map(alt => `- ${alt.description}
  Tradeoffs:
${alt.tradeoffs.map(tradeoff => `  - ${tradeoff}`).join('\n')}`).join('\n')}` : ''}`).join('\n')}

## Verification Plan

### Test Cases
${result.verification.testCases.map(test => `
#### ${test.id}: ${test.description}

**Input:**
\`\`\`json
${JSON.stringify(test.input, null, 2)}
\`\`\`

**Expected Output:**
\`\`\`json
${JSON.stringify(test.expectedOutput, null, 2)}
\`\`\`

${test.setup?.length ? `**Setup:**
${test.setup.map(step => `1. ${step}`).join('\n')}` : ''}

**Assertions:**
${test.assertions.map(assertion => `- ${assertion}`).join('\n')}

${test.cleanup?.length ? `**Cleanup:**
${test.cleanup.map(step => `1. ${step}`).join('\n')}` : ''}`).join('\n')}

### Regression Testing Areas
${result.verification.regressionAreas.map(area => `- ${area}`).join('\n')}

### Post-Deployment Monitoring
${result.verification.postDeploymentMonitoring.map(item => `- ${item}`).join('\n')}

## Recommendations

### Immediate Actions
${result.recommendations.immediate.map(rec => `- ${rec}`).join('\n')}

### Short-term Improvements
${result.recommendations.shortTerm.map(rec => `- ${rec}`).join('\n')}

### Long-term Improvements
${result.recommendations.longTerm.map(rec => `- ${rec}`).join('\n')}

## Quality Checklist
- [x] Issues properly categorized
- [x] Debug steps documented
- [x] Fixes proposed with explanations
- [x] Test cases defined
- [x] Side effects considered
- [x] Monitoring plan established
- [x] Recommendations prioritized`;
  }

  /**
   * Execute the code debugging action
   * @returns Debug results and fixes
   */
  public async run(): Promise<ActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Generate debug analysis using LLM
      const response = await this.ask(prompt);
      
      // Parse and validate debug result
      const result = this.parseDebugResult(response);
      
      // Format as markdown
      const formattedResult = this.formatDebugResult(result);
      
      return this.createOutput(
        formattedResult,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in debugging:`, error);
      return this.createOutput(
        `Failed to debug code: ${error}`,
        'failed'
      );
    }
  }
} 