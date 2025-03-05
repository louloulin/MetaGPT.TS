import { MGXArchitect } from '../../src/mgx/roles/mgx-architect';
import { MGXDeveloper } from '../../src/mgx/roles/mgx-developer';
import { createLLMProvider } from './../llm-provider';
import { DesignArchitecture } from '../../src/actions/design-architecture';
import { EvaluateDesign } from '../../src/actions/evaluate-design';
import { ReviewCode } from '../../src/actions/review-code';
import { WriteCode } from '../../src/actions/write-code';
import { WriteTest } from '../../src/actions/write-test';
import { DebugCode } from '../../src/actions/debug-code';
import { logger } from '../../src/utils/logger';

/**
 * Example demonstrating MGX team collaboration between Architect and Developer roles
 */
async function main() {
  try {
    // Initialize LLM provider
    const llm = createLLMProvider("你是一个资深的软件专家");

    // Create actions with LLM
    const architectActions = [
      new DesignArchitecture({ name: 'DesignArchitecture', llm }),
      new EvaluateDesign({ name: 'EvaluateDesign', llm }),
      new ReviewCode({ name: 'ReviewCode', llm })
    ];

    const developerActions = [
      new WriteCode({ name: 'WriteCode', llm }),
      new WriteTest({ name: 'WriteTest', llm }),
      new DebugCode({ name: 'DebugCode', llm })
    ];

    // Create MGX team roles
    const architect = new MGXArchitect(
      'SystemArchitect',
      'Senior System Architect',
      'Design robust and scalable system architecture',
      'Follow best practices and ensure system quality',
      undefined, // Use default capabilities
      architectActions
    );

    const developer = new MGXDeveloper(
      'SeniorDev',
      'Senior Software Developer',
      'Implement high-quality code following the architecture',
      'Write clean, tested, and documented code',
      undefined, // Use default capabilities
      llm,
      developerActions
    );

    // Project requirements
    const requirements = `
    Create a task management system with the following features:
    1. User authentication and authorization
    2. Task CRUD operations
    3. Task assignment and status tracking
    4. Project organization
    5. Real-time notifications
    `;

    // Step 1: Architect designs the system
    logger.info('Step 1: Architect designs the system');
    const designAction = architect.actions[0];
    designAction.context.args = { requirements };
    const design = await designAction.run();
    logger.info('Architecture Design:', design.content);

    // Step 2: Architect evaluates the design
    logger.info('\nStep 2: Architect evaluates the design');
    const evaluateAction = architect.actions[1];
    evaluateAction.context.args = { design: design.content, requirements };
    const evaluation = await evaluateAction.run();
    logger.info('Design Evaluation:', evaluation.content);

    // Step 3: Developer implements the core functionality
    logger.info('\nStep 3: Developer implements the core functionality');
    const writeCodeAction = developer.actions[0];
    writeCodeAction.context.args = {
      requirements,
      design: design.content,
      language: 'TypeScript',
    };
    const implementation = await writeCodeAction.run();
    logger.info('Implementation:', implementation.content);

    // Step 4: Developer writes tests
    logger.info('\nStep 4: Developer writes tests');
    const writeTestAction = developer.actions[1];
    writeTestAction.context.args = {
      code: implementation.content,
      language: 'TypeScript',
      testFramework: 'Jest',
    };
    const tests = await writeTestAction.run();
    logger.info('Tests:', tests.content);

    // Step 5: Architect reviews the implementation
    logger.info('\nStep 5: Architect reviews the implementation');
    const reviewAction = architect.actions[2];
    reviewAction.context.args = {
      code: implementation.content,
      language: 'TypeScript',
      context: design.content,
    };
    const review = await reviewAction.run();
    logger.info('Code Review:', review.content);

  } catch (error) {
    logger.error('Error in MGX team example:', error);
  }
}

// Run the example
main().catch(console.error); 