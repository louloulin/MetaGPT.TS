/**
 * Action Orchestration Example
 * 
 * Demonstrates the usage of ActionNode and ActionOrchestrator for complex workflows
 */

import { 
  ActionNode, 
  ActionOrchestrator, 
  ActionNodeStatus, 
  OrchestrationMode, 
  FillMode 
} from '../index';
import type { LLMProvider } from '../../types/llm';

// Mock LLM Provider for demonstration
class MockLLMProvider implements LLMProvider {
  async chat(prompt: string): Promise<string> {
    // Simulate different responses based on prompt content
    if (prompt.includes('analyze requirements')) {
      return JSON.stringify({
        requirements: ['User authentication', 'Data storage', 'API endpoints'],
        priority: 'high',
        complexity: 'medium'
      });
    } else if (prompt.includes('design architecture')) {
      return JSON.stringify({
        architecture: 'microservices',
        components: ['auth-service', 'data-service', 'api-gateway'],
        database: 'postgresql'
      });
    } else if (prompt.includes('generate code')) {
      return `
\`\`\`typescript
class UserService {
  async createUser(userData: UserData): Promise<User> {
    // Implementation here
    return new User(userData);
  }
}
\`\`\`
      `;
    } else if (prompt.includes('write tests')) {
      return `
\`\`\`typescript
describe('UserService', () => {
  it('should create user successfully', async () => {
    const service = new UserService();
    const user = await service.createUser(mockUserData);
    expect(user).toBeDefined();
  });
});
\`\`\`
      `;
    }
    
    return 'Mock response';
  }

  async *chatStream(prompt: string): AsyncGenerator<string> {
    const response = await this.chat(prompt);
    yield response;
  }

  setSystemPrompt(prompt: string): void {
    // Mock implementation
  }

  getSystemPrompt(): string {
    return 'Mock system prompt';
  }
}

/**
 * Example: Software Development Workflow
 * 
 * This example demonstrates a complete software development workflow using
 * ActionNode and ActionOrchestrator with proper dependency management.
 */
export async function softwareDevelopmentWorkflowExample(): Promise<void> {
  console.log('🚀 Starting Software Development Workflow Example\n');

  // Create LLM provider
  const llm = new MockLLMProvider();

  // Create action nodes for different development phases
  const requirementsAnalysisNode = new ActionNode({
    key: 'requirements-analysis',
    expectedType: 'object',
    instruction: 'analyze requirements and identify key features, priorities, and complexity',
    example: {
      requirements: ['feature1', 'feature2'],
      priority: 'high',
      complexity: 'medium'
    },
    enableCache: true
  });

  const architectureDesignNode = new ActionNode({
    key: 'architecture-design',
    expectedType: 'object',
    instruction: 'design architecture based on requirements analysis',
    example: {
      architecture: 'microservices',
      components: ['service1', 'service2'],
      database: 'postgresql'
    },
    validator: (result) => {
      return result && result.architecture && result.components && result.components.length > 0;
    }
  });

  const codeGenerationNode = new ActionNode({
    key: 'code-generation',
    expectedType: 'string',
    instruction: 'generate code based on architecture design',
    example: 'class Example { }',
    rollback: async (result) => {
      console.log('🔄 Rolling back code generation...');
      // Cleanup generated files, etc.
    }
  });

  const testGenerationNode = new ActionNode({
    key: 'test-generation',
    expectedType: 'string',
    instruction: 'write tests for the generated code',
    example: 'describe("Example", () => { it("should work", () => {}) });'
  });

  // Create orchestrator
  const orchestrator = new ActionOrchestrator({
    id: 'software-development-workflow',
    mode: OrchestrationMode.MIXED,
    maxConcurrency: 2,
    timeout: 30000,
    autoRollback: true,
    continueOnError: false,
    retry: {
      maxAttempts: 3,
      delay: 1000,
      backoff: 2
    }
  });

  // Add nodes to orchestrator
  orchestrator.addNode(requirementsAnalysisNode);
  orchestrator.addNode(architectureDesignNode);
  orchestrator.addNode(codeGenerationNode);
  orchestrator.addNode(testGenerationNode);

  // Set up dependencies
  orchestrator.addDependency('requirements-analysis', 'architecture-design');
  orchestrator.addDependency('architecture-design', 'code-generation');
  orchestrator.addDependency('code-generation', 'test-generation');

  console.log('📋 Workflow Summary:');
  console.log(JSON.stringify(orchestrator.getSummary(), null, 2));
  console.log();

  // Execute the workflow
  const executionContext = {
    llm,
    context: 'Building a user management system with authentication and data persistence',
    fillMode: FillMode.JSON
  };

  try {
    console.log('⚡ Executing workflow...\n');
    
    const result = await orchestrator.execute(executionContext);
    
    if (result.success) {
      console.log('✅ Workflow completed successfully!');
      console.log(`⏱️  Total execution time: ${result.duration}ms\n`);
      
      // Display results for each phase
      for (const nodeResult of result.results) {
        console.log(`📊 ${nodeResult.nodeId}:`);
        console.log(`   Status: ${nodeResult.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`   Duration: ${nodeResult.duration}ms`);
        if (nodeResult.result) {
          console.log(`   Result: ${JSON.stringify(nodeResult.result, null, 2)}`);
        }
        console.log();
      }
    } else {
      console.log('❌ Workflow failed!');
      console.log(`Error: ${result.error?.message}`);
    }

  } catch (error) {
    console.error('💥 Workflow execution failed:', error);
  }

  // Display final orchestrator status
  console.log('📈 Final Status:');
  console.log(JSON.stringify(orchestrator.getSummary(), null, 2));
}

/**
 * Example: Parallel Data Processing Workflow
 * 
 * This example demonstrates parallel execution of independent tasks.
 */
export async function parallelDataProcessingExample(): Promise<void> {
  console.log('🔄 Starting Parallel Data Processing Example\n');

  const llm = new MockLLMProvider();

  // Create independent data processing nodes
  const dataValidationNode = new ActionNode({
    key: 'data-validation',
    expectedType: 'object',
    instruction: 'validate input data format and integrity',
    example: { valid: true, errors: [] }
  });

  const dataTransformationNode = new ActionNode({
    key: 'data-transformation',
    expectedType: 'object',
    instruction: 'transform data to required format',
    example: { transformed: true, format: 'json' }
  });

  const dataEnrichmentNode = new ActionNode({
    key: 'data-enrichment',
    expectedType: 'object',
    instruction: 'enrich data with additional information',
    example: { enriched: true, sources: ['api1', 'api2'] }
  });

  // Create parallel orchestrator
  const parallelOrchestrator = new ActionOrchestrator({
    id: 'parallel-data-processing',
    mode: OrchestrationMode.PARALLEL,
    maxConcurrency: 3,
    continueOnError: true
  });

  // Add independent nodes (no dependencies)
  parallelOrchestrator.addNode(dataValidationNode);
  parallelOrchestrator.addNode(dataTransformationNode);
  parallelOrchestrator.addNode(dataEnrichmentNode);

  const context = {
    llm,
    context: 'Processing customer data batch with validation, transformation, and enrichment',
    fillMode: FillMode.JSON
  };

  console.log('⚡ Executing parallel workflow...\n');

  const startTime = Date.now();
  const result = await parallelOrchestrator.execute(context);
  const endTime = Date.now();

  console.log(`✅ Parallel execution completed in ${endTime - startTime}ms`);
  console.log(`📊 Results: ${result.results.length} tasks processed`);
  
  for (const nodeResult of result.results) {
    console.log(`   ${nodeResult.nodeId}: ${nodeResult.success ? '✅' : '❌'} (${nodeResult.duration}ms)`);
  }
}

/**
 * Example: Error Handling and Rollback
 * 
 * This example demonstrates error handling and rollback capabilities.
 */
export async function errorHandlingExample(): Promise<void> {
  console.log('🛠️  Starting Error Handling Example\n');

  const llm = new MockLLMProvider();

  // Create a node that will fail
  const failingNode = new ActionNode({
    key: 'failing-operation',
    expectedType: 'string',
    instruction: 'this operation will fail for demonstration',
    example: 'success',
    rollback: async (result) => {
      console.log('🔄 Rolling back failing operation...');
    }
  });

  // Create a successful node
  const successfulNode = new ActionNode({
    key: 'successful-operation',
    expectedType: 'string',
    instruction: 'this operation will succeed',
    example: 'success',
    rollback: async (result) => {
      console.log('🔄 Rolling back successful operation...');
    }
  });

  const errorOrchestrator = new ActionOrchestrator({
    id: 'error-handling-demo',
    mode: OrchestrationMode.SEQUENTIAL,
    autoRollback: true,
    continueOnError: false
  });

  errorOrchestrator.addNode(successfulNode);
  errorOrchestrator.addNode(failingNode);
  errorOrchestrator.addDependency('successful-operation', 'failing-operation');

  // Mock the failing node to actually fail
  const originalChat = llm.chat;
  llm.chat = async (prompt: string) => {
    if (prompt.includes('this operation will fail')) {
      throw new Error('Simulated failure for demonstration');
    }
    return originalChat.call(llm, prompt);
  };

  const context = {
    llm,
    context: 'Demonstrating error handling and rollback',
    fillMode: FillMode.RAW
  };

  try {
    const result = await errorOrchestrator.execute(context);
    
    if (!result.success) {
      console.log('❌ Workflow failed as expected');
      console.log(`Error: ${result.error?.message}`);
      console.log(`Status: ${errorOrchestrator.getStatus()}`);
    }
  } catch (error) {
    console.log('💥 Caught expected error:', (error as Error).message);
  }
}

/**
 * Run all examples
 */
export async function runActionOrchestrationExamples(): Promise<void> {
  console.log('🎯 Action Orchestration Examples\n');
  console.log('=' .repeat(50));
  
  try {
    await softwareDevelopmentWorkflowExample();
    console.log('\n' + '=' .repeat(50));
    
    await parallelDataProcessingExample();
    console.log('\n' + '=' .repeat(50));
    
    await errorHandlingExample();
    console.log('\n' + '=' .repeat(50));
    
    console.log('🎉 All examples completed!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runActionOrchestrationExamples();
}
