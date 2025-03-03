/**
 * Team Collaboration Example
 * 
 * This example demonstrates how to create a team of roles that can collaborate
 * together to solve a complex task. It showcases:
 * 
 * 1. Creating multiple roles with different expertise
 * 2. Setting up a workflow for role collaboration
 * 3. Passing messages between roles
 * 4. Coordinating tasks among team members
 */

// @ts-ignore
import dotenv from 'dotenv';
import { Engineer } from '../src/roles/engineer';
import { BaseRole } from '../src/roles/base-role';
import { VercelLLMProvider } from '../src/provider/vercel-llm';
import type { Message } from '../src/types/message';
import { logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables from .env file
dotenv.config();

/**
 * Product Manager role - responsible for defining requirements and coordinating the team
 */
class ProductManager extends BaseRole {
  constructor(llm?: any) {
    super(
      'ProductManager',
      'Product manager responsible for requirements and team coordination',
      'Define clear requirements and ensure successful product delivery',
      'Focus on user needs and business value. Communicate clearly and efficiently.'
    );
    
    // Initialize with the LLM if provided
    if (llm) {
      this.initWithLLM(llm);
    }
  }
  
  private initWithLLM(llm: any): void {
    // Add any specific actions for the product manager
  }
  
  /**
   * Create user stories from a requirement
   */
  async createUserStories(requirement: string): Promise<Message> {
    logger.info('Product Manager is creating user stories...');
    
    const userStories = `
    Based on the requirement: "${requirement}", here are the user stories:
    
    1. As a user, I want to see a landing page with a clear explanation of the service
    2. As a user, I want to register and login to the system
    3. As a user, I want to create new tasks with title, description, and status
    4. As a user, I want to view all my tasks in a list format
    5. As a user, I want to filter tasks by status (todo, in progress, done)
    6. As a user, I want to update the status of my tasks
    7. As a user, I want to delete tasks I no longer need
    `;
    
    return this.createMessage(userStories);
  }
  
  /**
   * Review implementation and provide feedback
   */
  async reviewImplementation(implementation: string): Promise<Message> {
    logger.info('Product Manager is reviewing the implementation...');
    
    const feedback = `
    Implementation Review:
    
    The implementation looks good overall. Here are some points of feedback:
    
    - The API endpoints match the requirements
    - Error handling has been implemented properly
    - Consider adding pagination for the GET /tasks endpoint
    - The in-memory storage is acceptable for this prototype
    
    Approved to proceed!
    `;
    
    return this.createMessage(feedback);
  }
}

/**
 * Designer role - responsible for creating user interface designs
 */
class Designer extends BaseRole {
  constructor(llm?: any) {
    super(
      'Designer',
      'UI/UX designer responsible for creating user-friendly interfaces',
      'Create intuitive and beautiful user interfaces',
      'Focus on user experience and visual appeal. Follow design principles.'
    );
    
    // Initialize with the LLM if provided
    if (llm) {
      this.initWithLLM(llm);
    }
  }
  
  private initWithLLM(llm: any): void {
    // Add any specific actions for the designer
  }
  
  /**
   * Create UI mockups based on user stories
   */
  async createMockups(userStories: string): Promise<Message> {
    logger.info('Designer is creating UI mockups...');
    
    const mockups = `
    UI Mockups (text representation):
    
    1. Landing Page:
       - Header with logo and navigation menu
       - Hero section with headline "Manage Your Tasks Efficiently"
       - Features section with 3 key benefits
       - Footer with contact information
    
    2. Task List View:
       - Left sidebar with filters (All, Todo, In Progress, Done)
       - Main area with task cards in grid layout
       - "Add Task" button in the top-right corner
       - Each task card shows title, truncated description, status, and action buttons
    
    3. Task Detail View:
       - Task title as header
       - Description in main content area
       - Status dropdown selector
       - Created/Updated timestamps
       - Delete and Edit buttons
    
    4. Add/Edit Task Form:
       - Input field for title
       - Textarea for description
       - Status dropdown
       - Cancel and Save buttons
    `;
    
    return this.createMessage(mockups);
  }
}

/**
 * Team class to coordinate multiple roles
 */
class Team {
  private roles: Map<string, BaseRole> = new Map();
  private messageHistory: Message[] = [];
  
  /**
   * Add a role to the team
   */
  addRole(role: BaseRole): void {
    this.roles.set(role.name, role);
  }
  
  /**
   * Get a role by name
   */
  getRole(name: string): BaseRole | undefined {
    return this.roles.get(name);
  }
  
  /**
   * Send a message from one role to another
   */
  async sendMessage(message: Message, fromRole: string, toRole: string): Promise<Message> {
    const sender = this.roles.get(fromRole);
    const receiver = this.roles.get(toRole);
    
    if (!sender || !receiver) {
      throw new Error(`Role not found: ${!sender ? fromRole : toRole}`);
    }
    
    // Update the message details
    message.sentFrom = sender.name;
    message.sendTo = new Set([receiver.name]);
    
    // Add to history
    this.messageHistory.push(message);
    
    // Process the message with the receiving role
    logger.info(`Sending message from ${fromRole} to ${toRole}`);
    const response = await receiver.run(message);
    
    // Add response to history
    this.messageHistory.push(response);
    
    return response;
  }
  
  /**
   * Create a message from a string content
   */
  createMessage(content: string, role: string): Message {
    return {
      id: uuidv4(),
      content,
      role,
      causedBy: 'team-collaboration',
      sentFrom: role,
      timestamp: new Date().toISOString(),
      sendTo: new Set([])
    };
  }
  
  /**
   * Run the team collaboration workflow
   */
  async runCollaboration(initialRequirement: string): Promise<void> {
    try {
      // Get the roles
      const productManager = this.getRole('ProductManager');
      const designer = this.getRole('Designer');
      const engineer = this.getRole('CodeEngineer');
      
      if (!productManager || !designer || !engineer) {
        throw new Error('Required roles are missing');
      }
      
      // Step 1: Product Manager creates user stories
      console.log('📝 Step 1: Product Manager creates user stories');
      const initialMsg = this.createMessage(initialRequirement, 'user');
      const userStories = await productManager.run(initialMsg);
      console.log('\nUser Stories:');
      console.log(userStories.content);
      
      // Step 2: Designer creates UI mockups based on user stories
      console.log('\n🎨 Step 2: Designer creates UI mockups');
      const mockups = await this.sendMessage(userStories, 'ProductManager', 'Designer');
      console.log('\nUI Mockups:');
      console.log(mockups.content);
      
      // Step 3: Engineer implements the API
      console.log('\n💻 Step 3: Engineer implements the API');
      const combinedRequirements = this.createMessage(
        `User Stories:\n${userStories.content}\n\nUI Mockups:\n${mockups.content}\n\nPlease implement the REST API for this task management system.`,
        'ProductManager'
      );
      const implementation = await this.sendMessage(combinedRequirements, 'ProductManager', 'CodeEngineer');
      console.log('\nAPI Implementation:');
      console.log(implementation.content);
      
      // Step 4: Product Manager reviews the implementation
      console.log('\n✅ Step 4: Product Manager reviews the implementation');
      const review = await this.sendMessage(implementation, 'CodeEngineer', 'ProductManager');
      console.log('\nReview Feedback:');
      console.log(review.content);
      
      // Display the Engineer's reasoning chain and task list
      // Cast to Engineer type to access specific methods
      const engineerRole = this.getRole('CodeEngineer');
      if (engineerRole && engineerRole instanceof Engineer) {
        console.log('\n🧠 Engineer\'s Reasoning Process:');
        console.log(engineerRole.getReasoningChainAsMarkdown());
        
        console.log('\n📋 Engineer\'s Task List:');
        console.log(engineerRole.getTodoListAsMarkdown());
      }
      
    } catch (error) {
      logger.error('Error in team collaboration:', error);
    }
  }
}

/**
 * Main function to run the team collaboration example
 */
async function main() {
  try {
    // Create the Vercel LLM provider with OpenAI model
    const llm = new VercelLLMProvider({
      providerType: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
    });
    
    // Create the team and roles
    const team = new Team();
    
    // Create and add the roles
    const productManager = new ProductManager(llm);
    const designer = new Designer(llm);
    
    // Create the engineer role separately
    const engineer = new Engineer(
      'CodeEngineer',
      'Senior software engineer with expertise in TypeScript and Node.js',
      'Implement high-quality, maintainable code using best practices',
      llm
    );
    
    // Add roles to the team
    team.addRole(productManager);
    team.addRole(designer);
    
    // Add engineer to the team - now Engineer properly extends BaseRole
    team.addRole(engineer);
    
    // Project requirement
    const projectRequirement = `
    Create a task management web application that allows users to create, view, update, and delete tasks.
    Each task should have a title, description, and status (todo, in progress, done).
    The application should have a clean and intuitive user interface.
    `;
    
    console.log('🚀 Starting Team Collaboration Example');
    console.log('======================================');
    console.log('Project Requirement:');
    console.log(projectRequirement);
    console.log('======================================\n');
    
    // Run the team collaboration workflow
    await team.runCollaboration(projectRequirement);
    
  } catch (error) {
    logger.error('Error running team collaboration example:', error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
} 