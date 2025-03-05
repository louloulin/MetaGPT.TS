import { BaseRole } from './base-role';
import type { Message } from '../types/message';
import type { Action } from '../types/action';
import { logger } from '../utils/logger';

/**
 * QA Engineer Role
 * Responsible for testing, quality assurance, and finding bugs in code
 */
export class QAEngineer extends BaseRole {
  constructor(
    name: string = 'QAEngineer',
    profile: string = 'Quality Assurance Engineer',
    goal: string = 'Ensure high quality code with thorough testing and bug detection',
    constraints: string = 'Focus on test coverage, edge cases, and user experience. Prioritize critical paths and security vulnerabilities.',
    actions: Action[] = []
  ) {
    super(name, profile, goal, constraints, actions);
    this.desc = 'Creates test plans, writes test cases, identifies bugs, and provides quality feedback';
  }

  /**
   * Create a test plan for a given code or requirement
   * @param message - Message containing the code or requirements to test
   * @returns The generated test plan
   */
  async createTestPlan(message: Message): Promise<string> {
    logger.info(`[${this.name}] Creating test plan for: ${message.content.substring(0, 100)}...`);
    
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a Quality Assurance Engineer, create a comprehensive test plan for the following code/requirements:
      
      CODE/REQUIREMENTS:
      ${message.content}
      
      Please include:
      1. Test objectives and scope
      2. Test strategy (types of testing required)
      3. Features to be tested
      4. Testing environment requirements
      5. Test deliverables
      6. Testing schedule and milestones
      7. Risks and contingencies
      
      Format your response as a detailed test plan document using markdown.
      `;
      
      try {
        return await llm.chat(prompt);
      } catch (error) {
        logger.error(`[${this.name}] Error creating test plan:`, error);
        return `Failed to create test plan: ${error}`;
      }
    }
    
    return "Test plan creation requires an LLM provider. Please configure one.";
  }

  /**
   * Write test cases for a given code or feature
   * @param message - Message containing the code or feature to write tests for
   * @returns The generated test cases
   */
  async writeTestCases(message: Message): Promise<string> {
    logger.info(`[${this.name}] Writing test cases for: ${message.content.substring(0, 100)}...`);
    
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a Quality Assurance Engineer, write detailed test cases for the following code/feature:
      
      CODE/FEATURE:
      ${message.content}
      
      For each test case, please include:
      1. Test case ID and name
      2. Test description
      3. Preconditions
      4. Test steps
      5. Expected results
      6. Actual results (leave blank for now)
      7. Test data needed
      8. Priority/Severity
      
      Include a mix of:
      - Positive test cases (expected usage)
      - Negative test cases (error conditions)
      - Edge cases
      - Performance test cases (if applicable)
      - Security test cases (if applicable)
      
      Format your response as a structured test case document using markdown.
      `;
      
      try {
        return await llm.chat(prompt);
      } catch (error) {
        logger.error(`[${this.name}] Error writing test cases:`, error);
        return `Failed to write test cases: ${error}`;
      }
    }
    
    return "Test case writing requires an LLM provider. Please configure one.";
  }

  /**
   * Find bugs in provided code
   * @param message - Message containing the code to analyze for bugs
   * @returns The bug report
   */
  async findBugs(message: Message): Promise<string> {
    logger.info(`[${this.name}] Finding bugs in: ${message.content.substring(0, 100)}...`);
    
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a Quality Assurance Engineer, analyze the following code for bugs, errors, and potential issues:
      
      CODE:
      ${message.content}
      
      Please provide a detailed bug report including:
      1. Summary of identified issues
      2. For each bug:
         - Bug ID and description
         - Severity (Critical/High/Medium/Low)
         - Steps to reproduce
         - Expected vs. Actual behavior
         - Potential impact
         - Recommended fix
      3. Code quality observations
      4. Performance concerns
      5. Security vulnerabilities
      6. Edge cases not handled
      
      Format your response as a detailed bug report using markdown.
      `;
      
      try {
        return await llm.chat(prompt);
      } catch (error) {
        logger.error(`[${this.name}] Error finding bugs:`, error);
        return `Failed to find bugs: ${error}`;
      }
    }
    
    return "Bug finding requires an LLM provider. Please configure one.";
  }

  /**
   * Review test coverage for a codebase
   * @param message - Message containing the code and tests to review for coverage
   * @returns The test coverage analysis
   */
  async reviewTestCoverage(message: Message): Promise<string> {
    logger.info(`[${this.name}] Reviewing test coverage for: ${message.content.substring(0, 100)}...`);
    
    if (this.actions.length > 0 && this.actions[0].llm) {
      const llm = this.actions[0].llm;
      const prompt = `
      As a Quality Assurance Engineer, review the test coverage for the following code and tests:
      
      CODE AND TESTS:
      ${message.content}
      
      Please provide a detailed test coverage analysis including:
      1. Overall test coverage assessment
      2. Areas with good coverage
      3. Areas lacking coverage
      4. Types of tests missing (unit, integration, etc.)
      5. Critical paths that need more testing
      6. Edge cases not covered
      7. Recommendations to improve test coverage
      
      Format your response as a detailed test coverage report using markdown.
      `;
      
      try {
        return await llm.chat(prompt);
      } catch (error) {
        logger.error(`[${this.name}] Error reviewing test coverage:`, error);
        return `Failed to review test coverage: ${error}`;
      }
    }
    
    return "Test coverage review requires an LLM provider. Please configure one.";
  }

  /**
   * Override the decideNextAction method to implement QAEngineer-specific action selection
   */
  protected async decideNextAction(message?: Message): Promise<Action | null> {
    // If we have a message about testing or quality, prioritize testing actions
    if (message) {
      const content = message.content.toLowerCase();
      if (
        content.includes('test') || 
        content.includes('quality') || 
        content.includes('bug') || 
        content.includes('coverage')
      ) {
        // Find actions related to testing
        const testActions = this.actions.filter(action => 
          action.name.toLowerCase().includes('test') || 
          action.name.toLowerCase().includes('bug') ||
          action.name.toLowerCase().includes('quality')
        );
        
        if (testActions.length > 0) {
          return testActions[0];
        }
      }
    }
    
    // Default to parent implementation
    return await super.decideNextAction(message);
  }

  /**
   * Override the react method to add QAEngineer-specific behavior
   */
  async react(message?: Message): Promise<Message> {
    if (message) {
      const content = message.content.toLowerCase();
      
      // If the message is about creating a test plan
      if (
        content.includes('create test plan') || 
        content.includes('test plan') ||
        content.includes('testing plan')
      ) {
        const testPlan = await this.createTestPlan(message);
        
        // Add the test plan to memory
        const testPlanMessage = this.createMessage(
          `Test Plan:\n${testPlan}`
        );
        this.addToMemory(testPlanMessage);
        return testPlanMessage;
      }
      
      // If the message is about writing test cases
      if (
        content.includes('write test') || 
        content.includes('create test case') ||
        content.includes('test case')
      ) {
        const testCases = await this.writeTestCases(message);
        
        // Add the test cases to memory
        const testCasesMessage = this.createMessage(
          `Test Cases:\n${testCases}`
        );
        this.addToMemory(testCasesMessage);
        return testCasesMessage;
      }
      
      // If the message is about finding bugs
      if (
        content.includes('find bug') || 
        content.includes('bug report') ||
        content.includes('identify issue')
      ) {
        const bugReport = await this.findBugs(message);
        
        // Add the bug report to memory
        const bugReportMessage = this.createMessage(
          `Bug Report:\n${bugReport}`
        );
        this.addToMemory(bugReportMessage);
        return bugReportMessage;
      }
      
      // If the message is about test coverage
      if (
        content.includes('test coverage') || 
        content.includes('review test') ||
        content.includes('coverage analysis')
      ) {
        const coverageReport = await this.reviewTestCoverage(message);
        
        // Add the coverage report to memory
        const coverageReportMessage = this.createMessage(
          `Test Coverage Report:\n${coverageReport}`
        );
        this.addToMemory(coverageReportMessage);
        return coverageReportMessage;
      }
    }
    
    // Continue with the standard reaction process
    return super.react(message);
  }
} 