/**
 * Enhanced Engineer Role Example
 * 
 * This example demonstrates the use of the enhanced Engineer role with
 * chain-of-thought reasoning capabilities and the flexible code todos management.
 * 
 * The Engineer can now:
 * 1. Break down complex coding tasks into manageable steps
 * 2. Apply chain-of-thought reasoning to each step
 * 3. Manage dependencies between tasks
 * 4. Generate implementation code for each task
 * 5. Visualize the reasoning process and task dependencies
 */

// @ts-ignore
import dotenv from 'dotenv';
import { Engineer } from '../src/roles/engineer';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import type { Message } from '../src/types/message';
import { logger } from '../src/utils/logger';

// Load environment variables from .env file
dotenv.config();

async function main() {
  // Create the Vercel LLM provider with OpenAI model
  const llm = new VercelLLMProvider({
    providerType: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4',
  });
  
  // Create the enhanced Engineer role with the LLM
  const engineer = new Engineer(
    'CodeEngineer',
    'Senior software engineer with expertise in TypeScript and Node.js',
    'Implement high-quality, maintainable code using best practices',
    llm
  );
  
  // Set the coding task for the Engineer
  const codingTask = `
  Create a simple REST API for a task management system with the following requirements:
  
  1. Use Express.js as the web framework
  2. Implement the following endpoints:
     - GET /tasks - List all tasks
     - GET /tasks/:id - Get a specific task
     - POST /tasks - Create a new task
     - PUT /tasks/:id - Update a task
     - DELETE /tasks/:id - Delete a task
  
  3. Each task should have:
     - id (unique identifier)
     - title (string)
     - description (text)
     - status (enum: 'todo', 'in_progress', 'done')
     - created_at (timestamp)
     - updated_at (timestamp)
  
  4. Implement proper error handling
  5. Use in-memory storage for simplicity
  `;
  
  // Create a message from the coding task
  const userMessage = {
    id: '1',
    content: codingTask,
    role: 'user',
    causedBy: 'user-input',
    sentFrom: 'user',
    timestamp: new Date().toISOString(),
    sendTo: new Set(['CodeEngineer']),
  } as Message;
  
  try {
    console.log('🧠 Engineer is thinking...');
    
    // Run the Engineer role with the coding task
    const response = await engineer.run(userMessage);
    
    // Output the Engineer's analysis
    console.log('\n📋 Task Analysis and Implementation Plan:');
    console.log(response.content);
    
    // Get and display the reasoning chain
    console.log('\n🔄 Reasoning Process:');
    console.log(engineer.getReasoningChainAsMarkdown());
    
    // Get and display the task list
    console.log('\n📝 Task List:');
    console.log(engineer.getTodoListAsMarkdown());
    
    // Get and display the task dependency graph
    console.log('\n📊 Task Dependencies:');
    console.log(engineer.getTaskDependencyGraph());
    
  } catch (error) {
    logger.error('Error running Engineer:', error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
} 