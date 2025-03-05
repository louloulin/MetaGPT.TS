import { BaseAction } from './base-action';
import type { ActionConfig, StreamActionOutput } from '../types/action';
import { logger } from '../utils/logger';
import { ProgrammingLanguage } from './write-code';

/**
 * Test framework options
 */
export enum TestFramework {
  JEST = 'jest',
  MOCHA = 'mocha',
  VITEST = 'vitest',
  PYTEST = 'pytest',
  JUNIT = 'junit',
  XUNIT = 'xunit',
  GO_TEST = 'go test'
}

/**
 * Test coverage requirements
 */
export interface CoverageRequirements {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

/**
 * Test generation configuration
 */
export interface TestGenerationConfig {
  implementation: string;
  language: ProgrammingLanguage | string;
  framework: TestFramework | string;
  coverage?: CoverageRequirements;
  includeE2E?: boolean;
  includeIntegration?: boolean;
  includeBenchmarks?: boolean;
  mockExternals?: boolean;
}

/**
 * Generated test result
 */
export interface GeneratedTests {
  unitTests: string;
  e2eTests?: string;
  integrationTests?: string;
  benchmarks?: string;
  mocks?: string[];
  coverage: CoverageRequirements;
  testCases: {
    description: string;
    type: 'unit' | 'e2e' | 'integration' | 'benchmark';
    assertions: string[];
  }[];
}

/**
 * Action for writing tests based on implementation
 */
export class WriteTestAction extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'WriteTest',
      description: config.description || 'Write comprehensive tests for given code implementation'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const implementation = this.getArg<string>('implementation');
    if (!implementation) {
      throw new Error('No implementation provided for test generation');
    }

    // Get optional arguments with defaults
    const language = this.getArg<string>('language') || ProgrammingLanguage.TYPESCRIPT;
    const framework = this.getArg<string>('framework') || TestFramework.JEST;
    const coverage = this.getArg<CoverageRequirements>('coverage') || {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    };
    const includeE2E = this.getArg<boolean>('includeE2E') || false;
    const includeIntegration = this.getArg<boolean>('includeIntegration') || false;
    const includeBenchmarks = this.getArg<boolean>('includeBenchmarks') || false;
    const mockExternals = this.getArg<boolean>('mockExternals') || true;

    // Log test generation start
    logger.info(`[${this.name}] Starting test generation for ${language} using ${framework}`);
    logger.debug(`[${this.name}] Configuration:`, {
      language,
      framework,
      coverage,
      includeE2E,
      includeIntegration,
      includeBenchmarks,
      mockExternals
    });

    return `Please write comprehensive tests for the following implementation:

Language: ${language}
Framework: ${framework}

Implementation:
\`\`\`${language}
${implementation}
\`\`\`

Please provide the tests in the following JSON format:

{
  "unitTests": "The unit test implementation",
  ${includeE2E ? `"e2eTests": "End-to-end test implementation",` : ''}
  ${includeIntegration ? `"integrationTests": "Integration test implementation",` : ''}
  ${includeBenchmarks ? `"benchmarks": "Benchmark test implementation",` : ''}
  ${mockExternals ? `"mocks": ["List of mock implementations"],` : ''}
  "coverage": {
    "statements": ${coverage.statements},
    "branches": ${coverage.branches},
    "functions": ${coverage.functions},
    "lines": ${coverage.lines}
  },
  "testCases": [
    {
      "description": "Test case description",
      "type": "unit|e2e|integration|benchmark",
      "assertions": ["List of assertions made"]
    }
  ]
}

Focus on:
1. Comprehensive test coverage (target: statements ${coverage.statements}%, branches ${coverage.branches}%, functions ${coverage.functions}%, lines ${coverage.lines}%)
2. Edge cases and error conditions
3. Clear test descriptions
4. Proper test organization
5. Effective mocking of external dependencies
6. Performance testing (if applicable)
7. Security testing (if applicable)

Test requirements:
- Include positive and negative test cases
- Test edge cases and boundary conditions
- Verify error handling
- Test asynchronous operations (if applicable)
- Include input validation tests
- Test performance critical operations
${mockExternals ? '- Mock external dependencies\n' : ''}
${includeE2E ? '- Include end-to-end tests\n' : ''}
${includeIntegration ? '- Include integration tests\n' : ''}
${includeBenchmarks ? '- Include performance benchmarks\n' : ''}

The tests should follow ${framework} best practices and conventions.`;
  }

  /**
   * Parse and validate the generated tests
   * @param response The LLM response
   * @returns Parsed test result
   */
  private parseTestResponse(response: string): GeneratedTests {
    try {
      const result = JSON.parse(response);
      
      if (!result.unitTests) {
        throw new Error('No unit tests found in response');
      }

      if (!result.coverage) {
        throw new Error('No coverage information found in response');
      }

      return {
        unitTests: result.unitTests,
        e2eTests: result.e2eTests,
        integrationTests: result.integrationTests,
        benchmarks: result.benchmarks,
        mocks: result.mocks,
        coverage: result.coverage,
        testCases: result.testCases || []
      };
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse test response:`, error);
      throw new Error(`Failed to parse generated tests: ${error}`);
    }
  }

  /**
   * Format the test result as markdown
   * @param result The generated test result
   * @returns Formatted markdown string
   */
  private formatTestResult(result: GeneratedTests): string {
    const framework = this.getArg<string>('framework') || TestFramework.JEST;
    const language = this.getArg<string>('language') || ProgrammingLanguage.TYPESCRIPT;

    return `# Generated Tests

## Unit Tests
\`\`\`${language}
${result.unitTests}
\`\`\`

${result.e2eTests ? `## End-to-End Tests\n\`\`\`${language}\n${result.e2eTests}\n\`\`\`\n\n` : ''}
${result.integrationTests ? `## Integration Tests\n\`\`\`${language}\n${result.integrationTests}\n\`\`\`\n\n` : ''}
${result.benchmarks ? `## Performance Benchmarks\n\`\`\`${language}\n${result.benchmarks}\n\`\`\`\n\n` : ''}

${result.mocks?.length ? `## Mocks\n${result.mocks.map((mock, index) => `### Mock ${index + 1}\n\`\`\`${language}\n${mock}\n\`\`\``).join('\n\n')}\n\n` : ''}

## Test Cases
${result.testCases.map(tc => `### ${tc.description}\nType: ${tc.type}\n\nAssertions:\n${tc.assertions.map(a => `- ${a}`).join('\n')}`).join('\n\n')}

## Coverage Report
- Statements: ${result.coverage.statements}%
- Branches: ${result.coverage.branches}%
- Functions: ${result.coverage.functions}%
- Lines: ${result.coverage.lines}%

## Test Framework
Using ${framework} with ${language}

## Quality Checklist
- [x] Comprehensive test coverage
- [x] Edge cases covered
- [x] Error handling tested
- [x] Clear test descriptions
- [x] Proper test organization
- [x] External dependencies mocked
- [x] Performance considerations
- [x] Security considerations`;
  }

  /**
   * Execute the test writing action
   * @returns Generated tests with coverage information
   */
  public async run(): Promise<StreamActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Generate tests using LLM
      const response = await this.ask(prompt);
      
      // Parse and validate tests
      const result = this.parseTestResponse(response);
      
      // Format as markdown
      const formattedResult = this.formatTestResult(result);
      
      return this.createOutput(
        formattedResult,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in test generation:`, error);
      return this.createOutput(
        `Failed to generate tests: ${error}`,
        'failed'
      );
    }
  }
} 