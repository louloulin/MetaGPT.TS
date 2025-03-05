/**
 * Example demonstrating the usage of the role generator
 */

import { RoleGenerator } from '../src/role/role-generator';
import type { RoleTemplate, RoleCapability, RoleBehavior } from '../src/role/role-generator';
import { logger } from '../src/utils/logger';

async function main() {
  // Create a role generator instance
  const generator = new RoleGenerator();

  // Define a template for a ReviewerRole
  const reviewerTemplate: RoleTemplate = {
    name: 'ReviewerRole',
    description: 'A role that reviews and provides feedback on content',
    capabilities: [
      {
        name: 'codeReview',
        description: 'Ability to review code and provide feedback',
        requiredSkills: ['typescript', 'code-analysis'],
        inputSchema: {
          code: 'string',
          context: 'object',
        },
        outputSchema: {
          feedback: 'string',
          issues: 'array',
          suggestions: 'array',
        },
      },
      {
        name: 'documentReview',
        description: 'Ability to review documentation and provide feedback',
        requiredSkills: ['technical-writing', 'documentation'],
        inputSchema: {
          content: 'string',
          format: 'string',
        },
        outputSchema: {
          feedback: 'string',
          improvements: 'array',
        },
      },
    ],
    behaviors: [
      {
        name: 'reviewCode',
        trigger: 'REVIEW_CODE',
        preconditions: ['hasCodeReviewCapability'],
        postconditions: ['feedbackProvided'],
        implementation: 'async function reviewCode() { /* Implementation */ }',
      },
      {
        name: 'reviewDocument',
        trigger: 'REVIEW_DOCUMENT',
        preconditions: ['hasDocumentReviewCapability'],
        postconditions: ['feedbackProvided'],
        implementation: 'async function reviewDocument() { /* Implementation */ }',
      },
    ],
    metadata: {
      version: '1.0.0',
      category: 'quality-assurance',
    },
  };

  // Register the template
  generator.registerTemplate(reviewerTemplate);

  // Register custom validators
  generator.registerValidator('hasCodeReviewCapability', (role) => {
    return role.hasCapability('codeReview');
  });

  generator.registerValidator('hasDocumentReviewCapability', (role) => {
    return role.hasCapability('documentReview');
  });

  generator.registerValidator('feedbackProvided', (role) => {
    // Implement feedback validation logic
    return true; // Placeholder
  });

  // Generate a custom reviewer role with additional capabilities
  const CustomReviewerRole = generator.generateRole('ReviewerRole', {
    capabilities: [
      {
        name: 'securityReview',
        description: 'Ability to perform security reviews',
        requiredSkills: ['security-analysis', 'vulnerability-assessment'],
        inputSchema: {
          code: 'string',
          context: 'object',
        },
        outputSchema: {
          vulnerabilities: 'array',
          recommendations: 'array',
        },
      },
    ],
  });

  // Create an instance of the custom role
  const reviewer = new CustomReviewerRole('reviewer-1');

  // Validate the role
  const isValid = generator.validateRole(reviewer, 'ReviewerRole');
  logger.info(`Role validation result: ${isValid}`);

  // Display role capabilities
  logger.info('Role capabilities:');
  reviewer.getCapabilities().forEach((capability: RoleCapability) => {
    logger.info(`- ${capability.name}: ${capability.description}`);
  });

  // Display role behaviors
  logger.info('Role behaviors:');
  reviewer.getBehaviors().forEach((behavior: RoleBehavior) => {
    logger.info(`- ${behavior.name} (trigger: ${behavior.trigger})`);
  });
}

main().catch(console.error); 