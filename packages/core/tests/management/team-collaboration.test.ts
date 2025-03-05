import { describe, expect, test, beforeEach } from 'vitest';
import { TeamCollaboration, TaskState } from '../../src/management/team-collaboration';
import { Team } from '../../src/management/team';
import { Environment } from '../../src/environment/environment';
import type { Context } from '../../src/context/context';

// Mock Role implementation for testing
class MockRole {
  name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  setEnvironment() {}
  isIdle() { return true; }
  run() { return Promise.resolve(); }
}

// Mock Team implementation
class MockTeam {
  private roles: Map<string, MockRole> = new Map();
  
  constructor(roles: MockRole[] = []) {
    for (const role of roles) {
      this.roles.set(role.name, role);
    }
  }
  
  getRole(name: string) {
    return this.roles.get(name);
  }
  
  getRoles() {
    return Array.from(this.roles.values());
  }
}

describe('TeamCollaboration', () => {
  let teamCollaboration: TeamCollaboration;
  let mockTeam: MockTeam;
  
  beforeEach(() => {
    // Create mock roles
    const architect = new MockRole('Architect');
    const developer = new MockRole('Developer');
    const qaEngineer = new MockRole('QAEngineer');
    
    // Create mock team with roles
    mockTeam = new MockTeam([architect, developer, qaEngineer]);
    
    // Create TeamCollaboration instance
    teamCollaboration = new TeamCollaboration({
      team: mockTeam as any,
      maxConcurrentTasksPerRole: 2,
      autoAssignTasks: true,
    });
  });
  
  test('should create a task', () => {
    const task = teamCollaboration.createTask({
      title: 'Test Task',
      description: 'Task for testing',
    });
    
    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test Task');
    expect(task.description).toBe('Task for testing');
    expect(task.state).toBe(TaskState.PENDING);
  });
  
  test('should get task by ID', () => {
    const task = teamCollaboration.createTask({
      title: 'Test Task',
      description: 'Task for testing',
    });
    
    const retrievedTask = teamCollaboration.getTask(task.id);
    expect(retrievedTask).toBeDefined();
    expect(retrievedTask?.id).toBe(task.id);
  });
  
  test('should update a task', () => {
    const task = teamCollaboration.createTask({
      title: 'Test Task',
      description: 'Task for testing',
    });
    
    const updatedTask = teamCollaboration.updateTask(task.id, {
      state: TaskState.IN_PROGRESS,
      priority: 5,
    });
    
    expect(updatedTask).toBeDefined();
    expect(updatedTask?.state).toBe(TaskState.IN_PROGRESS);
    expect(updatedTask?.priority).toBe(5);
  });
  
  test('should delete a task', () => {
    const task = teamCollaboration.createTask({
      title: 'Test Task',
      description: 'Task for testing',
    });
    
    const deleted = teamCollaboration.deleteTask(task.id);
    expect(deleted).toBe(true);
    
    const retrievedTask = teamCollaboration.getTask(task.id);
    expect(retrievedTask).toBeUndefined();
  });
  
  test('should assign a task to a role', () => {
    const task = teamCollaboration.createTask({
      title: 'Test Task',
      description: 'Task for testing',
    });
    
    const assigned = teamCollaboration.assignTaskToRole(task, 'Architect');
    expect(assigned).toBe(true);
    
    const updatedTask = teamCollaboration.getTask(task.id);
    expect(updatedTask?.assignee).toBe('Architect');
    expect(updatedTask?.state).toBe(TaskState.ASSIGNED);
  });
  
  test('should get tasks for a role', () => {
    const task1 = teamCollaboration.createTask({
      title: 'Task 1',
      description: 'Task for Architect',
    });
    
    const task2 = teamCollaboration.createTask({
      title: 'Task 2',
      description: 'Another task for Architect',
    });
    
    teamCollaboration.assignTaskToRole(task1, 'Architect');
    teamCollaboration.assignTaskToRole(task2, 'Architect');
    
    const architectTasks = teamCollaboration.getTasksForRole('Architect');
    expect(architectTasks).toHaveLength(2);
    expect(architectTasks.map(t => t.id)).toContain(task1.id);
    expect(architectTasks.map(t => t.id)).toContain(task2.id);
  });
  
  test('should create a workflow of related tasks', () => {
    const workflow = teamCollaboration.createWorkflow('test-workflow', [
      {
        title: 'Task 1',
        description: 'First task in workflow',
      },
      {
        title: 'Task 2',
        description: 'Second task in workflow',
      },
      {
        title: 'Task 3',
        description: 'Third task in workflow',
      }
    ]);
    
    expect(workflow).toHaveLength(3);
    
    // Task 2 should depend on Task 1, and Task 3 should depend on Task 2
    expect(workflow[1].dependencies).toContain(workflow[0].id);
    expect(workflow[2].dependencies).toContain(workflow[1].id);
  });
  
  test('should get a workflow by ID', () => {
    const workflowTasks = teamCollaboration.createWorkflow('test-workflow', [
      {
        title: 'Task 1',
        description: 'First task in workflow',
      },
      {
        title: 'Task 2',
        description: 'Second task in workflow',
      }
    ]);
    
    const workflow = teamCollaboration.getWorkflow('test-workflow');
    expect(workflow).toBeDefined();
    expect(workflow).toHaveLength(2);
    expect(workflow?.[0].id).toBe(workflowTasks[0].id);
    expect(workflow?.[1].id).toBe(workflowTasks[1].id);
  });
  
  test('should start a workflow', () => {
    // Create workflow with three tasks
    const workflowTasks = teamCollaboration.createWorkflow('test-workflow', [
      {
        title: 'Task 1',
        description: 'First task in workflow',
      },
      {
        title: 'Task 2',
        description: 'Second task in workflow',
      },
      {
        title: 'Task 3',
        description: 'Third task in workflow',
      }
    ]);
    
    // Assign tasks to roles
    teamCollaboration.assignTaskToRole(workflowTasks[0], 'Architect');
    teamCollaboration.assignTaskToRole(workflowTasks[1], 'Developer');
    teamCollaboration.assignTaskToRole(workflowTasks[2], 'QAEngineer');
    
    // Start workflow
    const started = teamCollaboration.startWorkflow('test-workflow');
    expect(started).toBe(true);
    
    // Only first task should be in progress, others pending
    const task1 = teamCollaboration.getTask(workflowTasks[0].id);
    const task2 = teamCollaboration.getTask(workflowTasks[1].id);
    const task3 = teamCollaboration.getTask(workflowTasks[2].id);
    
    expect(task1?.state).toBe(TaskState.IN_PROGRESS);
    expect(task2?.state).toBe(TaskState.PENDING);
    expect(task3?.state).toBe(TaskState.PENDING);
    
    // Complete first task
    teamCollaboration.updateTask(workflowTasks[0].id, {
      state: TaskState.COMPLETED,
    });
    
    // Now second task should be in progress
    const updatedTask2 = teamCollaboration.getTask(workflowTasks[1].id);
    expect(updatedTask2?.state).toBe(TaskState.IN_PROGRESS);
  });
  
  test('should handle task dependencies correctly', () => {
    // Create three tasks with dependencies
    const task1 = teamCollaboration.createTask({
      title: 'Task 1',
      description: 'First task',
    });
    
    const task2 = teamCollaboration.createTask({
      title: 'Task 2',
      description: 'Second task',
      dependencies: [task1.id],
    });
    
    const task3 = teamCollaboration.createTask({
      title: 'Task 3',
      description: 'Third task',
      dependencies: [task2.id],
    });
    
    // Assign tasks
    teamCollaboration.assignTaskToRole(task1, 'Architect');
    teamCollaboration.assignTaskToRole(task2, 'Developer');
    teamCollaboration.assignTaskToRole(task3, 'QAEngineer');
    
    // Update task states
    teamCollaboration.updateTask(task1.id, { state: TaskState.IN_PROGRESS });
    
    // Task 2 should remain pending while Task 1 is in progress
    expect(teamCollaboration.getTask(task2.id)?.state).toBe(TaskState.ASSIGNED);
    
    // Complete Task 1
    teamCollaboration.updateTask(task1.id, { state: TaskState.COMPLETED });
    
    // Manually update task2 to in progress (in a real scenario, this would happen automatically)
    teamCollaboration.updateTask(task2.id, { state: TaskState.IN_PROGRESS });
    
    // Task 3 should remain pending while Task 2 is in progress
    expect(teamCollaboration.getTask(task3.id)?.state).toBe(TaskState.ASSIGNED);
    
    // Complete Task 2
    teamCollaboration.updateTask(task2.id, { state: TaskState.COMPLETED });
    
    // Manually update task3 to in progress (in a real scenario, this would happen automatically)
    teamCollaboration.updateTask(task3.id, { state: TaskState.IN_PROGRESS });
    
    // Complete Task 3
    teamCollaboration.updateTask(task3.id, { state: TaskState.COMPLETED });
    
    // All tasks should be completed
    expect(teamCollaboration.getTask(task1.id)?.state).toBe(TaskState.COMPLETED);
    expect(teamCollaboration.getTask(task2.id)?.state).toBe(TaskState.COMPLETED);
    expect(teamCollaboration.getTask(task3.id)?.state).toBe(TaskState.COMPLETED);
  });
}); 