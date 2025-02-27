import { Team } from '../src/management/team';
import { TeamCollaboration } from '../src/management/team-collaboration';
import { WorkflowOrchestration, WorkflowNodeType } from '../src/management/workflow-orchestration';
import { TaskState } from '../src/management/team-collaboration';
import { Environment } from '../src/environment/environment';
import type { Context } from '../src/context/context';
import type { Message } from '../src/types/message';
import { logger } from '../src/utils/logger';

// Example role classes (simplified for demonstration)
class ArchitectRole {
  name = 'Architect';
  profile = 'System designer responsible for high-level architecture';
  goal = ['Design robust system architecture'];
  constraints = ['Follow best practices', 'Consider scalability'];

  setEnvironment(env: Environment) {
    console.log('Environment set for Architect');
  }

  isIdle() {
    return true;
  }

  async run() {
    console.log('Architect is designing...');
  }
}

class DeveloperRole {
  name = 'Developer';
  profile = 'Software developer responsible for implementation';
  goal = ['Implement features', 'Write clean code'];
  constraints = ['Follow coding standards', 'Write tests'];

  setEnvironment(env: Environment) {
    console.log('Environment set for Developer');
  }

  isIdle() {
    return true;
  }

  async run() {
    console.log('Developer is coding...');
  }
}

class QAEngineerRole {
  name = 'QA Engineer';
  profile = 'Quality Assurance engineer responsible for testing';
  goal = ['Ensure software quality', 'Find and report bugs'];
  constraints = ['Thorough testing', 'Document issues properly'];

  setEnvironment(env: Environment) {
    console.log('Environment set for QA Engineer');
  }

  isIdle() {
    return true;
  }

  async run() {
    console.log('QA Engineer is testing...');
  }
}

/**
 * Example demonstrating the use of TeamCollaboration and WorkflowOrchestration
 */
async function runTeamCollaborationExample() {
  logger.info('Starting Team Collaboration Example');

  // Create a team with roles
  const context = {} as Context;
  const environment = new Environment({ 
    context,
    description: 'Team collaboration environment',
    maxHistorySize: 1000
  });
  const team = new Team({
    environment,
    idea: 'Build a task management application',
  });

  // Add roles to the team
  const architect = new ArchitectRole();
  const developer = new DeveloperRole();
  const qaEngineer = new QAEngineerRole();
  team.hire([architect as any, developer as any, qaEngineer as any]);

  // Create a TeamCollaboration instance
  const teamCollaboration = new TeamCollaboration({
    team,
    maxConcurrentTasksPerRole: 2,
    autoAssignTasks: true,
  });

  // Create tasks
  logger.info('Creating tasks...');
  const designTask = teamCollaboration.createTask({
    title: 'Design System Architecture',
    description: 'Create high-level system design for the task management app',
  });

  const implementTask = teamCollaboration.createTask({
    title: 'Implement Core Features',
    description: 'Develop the core features of the task management app',
    dependencies: [designTask.id], // Implementation depends on design
  });

  const testTask = teamCollaboration.createTask({
    title: 'Test Application',
    description: 'Perform testing of the implemented features',
    dependencies: [implementTask.id], // Testing depends on implementation
  });

  // Manually assign tasks to specific roles
  logger.info('Assigning tasks to roles...');
  teamCollaboration.assignTaskToRole(designTask, 'Architect');
  teamCollaboration.assignTaskToRole(implementTask, 'Developer');
  teamCollaboration.assignTaskToRole(testTask, 'QA Engineer');

  // Create workflow orchestration
  const workflowOrchestration = new WorkflowOrchestration({
    teamCollaboration,
    maxParallelTasks: 3,
    executionTimeout: 60000, // 1 minute for demo purposes
    enableAutoRecovery: true
  });

  // Define a workflow
  const workflow = workflowOrchestration.registerWorkflow({
    id: 'development-workflow',
    name: 'Software Development Workflow',
    description: 'Standard workflow for software development',
    inputs: {},
    outputs: {},
    metadata: {},
    nodes: [
      {
        id: 'start',
        type: WorkflowNodeType.START,
        name: 'Start Development',
        description: 'Starting point of the workflow',
        inputs: {},
        outputs: {},
        metadata: {}
      },
      {
        id: 'design',
        type: WorkflowNodeType.TASK,
        name: 'Design Architecture',
        description: 'Design the system architecture',
        taskId: designTask.id,
        inputs: {},
        outputs: {},
        metadata: {}
      },
      {
        id: 'implement',
        type: WorkflowNodeType.TASK,
        name: 'Implement Features',
        description: 'Implement the core features',
        taskId: implementTask.id,
        inputs: {},
        outputs: {},
        metadata: {}
      },
      {
        id: 'test',
        type: WorkflowNodeType.TASK,
        name: 'Test Application',
        description: 'Perform testing of the application',
        taskId: testTask.id,
        inputs: {},
        outputs: {},
        metadata: {}
      },
      {
        id: 'end',
        type: WorkflowNodeType.END,
        name: 'End Development',
        description: 'End point of the workflow',
        inputs: {},
        outputs: {},
        metadata: {}
      },
    ],
    edges: [
      {
        id: 'start-design',
        source: 'start',
        target: 'design',
        label: 'Design phase',
        metadata: {}
      },
      {
        id: 'design-implement',
        source: 'design',
        target: 'implement',
        label: 'Implementation phase',
        metadata: {}
      },
      {
        id: 'implement-test',
        source: 'implement',
        target: 'test',
        label: 'Testing phase',
        metadata: {}
      },
      {
        id: 'test-end',
        source: 'test',
        target: 'end',
        label: 'Completion',
        metadata: {}
      },
    ],
  });

  // Create and start a workflow instance
  logger.info('Creating and starting workflow instance...');
  const instance = workflowOrchestration.createWorkflowInstance('development-workflow');
  workflowOrchestration.startWorkflowInstance(instance.id);

  // Demo: Update task states for simulation purposes
  setTimeout(() => {
    logger.info('Updating task states for simulation...');
    teamCollaboration.updateTask(designTask.id, { state: TaskState.COMPLETED, result: 'Architecture design document' });
    
    setTimeout(() => {
      teamCollaboration.updateTask(implementTask.id, { state: TaskState.COMPLETED, result: 'Implemented code' });
      
      setTimeout(() => {
        teamCollaboration.updateTask(testTask.id, { state: TaskState.COMPLETED, result: 'Test report' });
        
        // Check final workflow state
        setTimeout(() => {
          const finalInstance = workflowOrchestration.getWorkflowInstance(instance.id);
          logger.info('Workflow completed with state:', finalInstance?.state);
          logger.info('Workflow results:', JSON.stringify(finalInstance?.nodeResults, null, 2));
        }, 1000);
      }, 2000);
    }, 2000);
  }, 2000);
}

// Run the example
runTeamCollaborationExample().catch(err => {
  logger.error('Error in team collaboration example:', err);
}); 