import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { 
  WorkflowOrchestration, 
  WorkflowNodeType,
  WorkflowInstanceState 
} from '../../src/management/workflow-orchestration';
import { TeamCollaboration, TaskState } from '../../src/management/team-collaboration';

// Mock TeamCollaboration
class MockTeamCollaboration {
  private tasks: Map<string, any> = new Map();
  
  createTask(taskData: any) {
    const task = {
      id: taskData.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: taskData.title,
      description: taskData.description,
      state: TaskState.PENDING,
      assignee: taskData.assignee,
      dependencies: taskData.dependencies || [],
      result: taskData.result,
      error: taskData.error,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.tasks.set(task.id, task);
    return task;
  }
  
  getTask(id: string) {
    return this.tasks.get(id);
  }
  
  updateTask(id: string, updates: any) {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = {
      ...task,
      ...updates,
      id, // ensure ID doesn't change
      updatedAt: new Date(),
    };
    
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }
}

describe('WorkflowOrchestration', () => {
  let workflowOrchestration: WorkflowOrchestration;
  let mockTeamCollaboration: MockTeamCollaboration;
  
  beforeEach(() => {
    // Create mock TeamCollaboration
    mockTeamCollaboration = new MockTeamCollaboration();
    
    // Create WorkflowOrchestration instance
    workflowOrchestration = new WorkflowOrchestration({
      teamCollaboration: mockTeamCollaboration as any,
      maxParallelTasks: 3,
      executionTimeout: 5000,
      enableAutoRecovery: true,
    });
    
    // Mock setTimeout
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  test('should register a workflow definition', () => {
    const workflow = workflowOrchestration.registerWorkflow({
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'Workflow for testing',
      inputs: {},
      outputs: {},
      metadata: {},
      nodes: [
        {
          id: 'start',
          type: WorkflowNodeType.START,
          name: 'Start',
          description: 'Start node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'end',
          type: WorkflowNodeType.END,
          name: 'End',
          description: 'End node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'start-to-end',
          source: 'start',
          target: 'end',
          label: '',
          metadata: {},
        },
      ],
    });
    
    expect(workflow).toBeDefined();
    expect(workflow.id).toBe('test-workflow');
    
    const retrievedWorkflow = workflowOrchestration.getWorkflow('test-workflow');
    expect(retrievedWorkflow).toBeDefined();
    expect(retrievedWorkflow?.id).toBe('test-workflow');
  });
  
  test('should create a workflow instance', () => {
    // Register workflow
    workflowOrchestration.registerWorkflow({
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'Workflow for testing',
      inputs: {},
      outputs: {},
      metadata: {},
      nodes: [
        {
          id: 'start',
          type: WorkflowNodeType.START,
          name: 'Start',
          description: 'Start node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'end',
          type: WorkflowNodeType.END,
          name: 'End',
          description: 'End node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'start-to-end',
          source: 'start',
          target: 'end',
          label: '',
          metadata: {},
        },
      ],
    });
    
    // Create instance
    const instance = workflowOrchestration.createWorkflowInstance('test-workflow', { test: 'value' });
    
    expect(instance).toBeDefined();
    expect(instance.workflowId).toBe('test-workflow');
    expect(instance.state).toBe(WorkflowInstanceState.CREATED);
    expect(instance.variables).toHaveProperty('test', 'value');
  });
  
  test('should start a workflow instance', () => {
    // Register workflow
    workflowOrchestration.registerWorkflow({
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'Workflow for testing',
      inputs: {},
      outputs: {},
      metadata: {},
      nodes: [
        {
          id: 'start',
          type: WorkflowNodeType.START,
          name: 'Start',
          description: 'Start node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'end',
          type: WorkflowNodeType.END,
          name: 'End',
          description: 'End node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'start-to-end',
          source: 'start',
          target: 'end',
          label: '',
          metadata: {},
        },
      ],
    });
    
    // Create instance
    const instance = workflowOrchestration.createWorkflowInstance('test-workflow');
    
    // Start instance
    const startedInstance = workflowOrchestration.startWorkflowInstance(instance.id);
    
    expect(startedInstance).toBeDefined();
    expect(startedInstance.state).toBe(WorkflowInstanceState.RUNNING);
    expect(startedInstance.startTime).toBeDefined();
    
    // Advance timers to complete workflow
    vi.advanceTimersByTime(1000);
    
    // Check final state
    const finalInstance = workflowOrchestration.getWorkflowInstance(instance.id);
    expect(finalInstance?.state).toBe(WorkflowInstanceState.COMPLETED);
  });
  
  test('should handle tasks in a workflow', () => {
    // Create a task
    const task = mockTeamCollaboration.createTask({
      title: 'Test Task',
      description: 'Task for testing',
    });
    
    // Register workflow with task
    workflowOrchestration.registerWorkflow({
      id: 'task-workflow',
      name: 'Task Workflow',
      description: 'Workflow with tasks',
      inputs: {},
      outputs: {},
      metadata: {},
      nodes: [
        {
          id: 'start',
          type: WorkflowNodeType.START,
          name: 'Start',
          description: 'Start node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'task-node',
          type: WorkflowNodeType.TASK,
          name: 'Task Node',
          description: 'Task node',
          taskId: task.id,
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'end',
          type: WorkflowNodeType.END,
          name: 'End',
          description: 'End node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'start-to-task',
          source: 'start',
          target: 'task-node',
          label: '',
          metadata: {},
        },
        {
          id: 'task-to-end',
          source: 'task-node',
          target: 'end',
          label: '',
          metadata: {},
        },
      ],
    });
    
    // Create and start instance
    const instance = workflowOrchestration.createWorkflowInstance('task-workflow');
    workflowOrchestration.startWorkflowInstance(instance.id);
    
    // Check initial state
    const initialInstance = workflowOrchestration.getWorkflowInstance(instance.id);
    expect(initialInstance?.state).toBe(WorkflowInstanceState.RUNNING);
    
    // Advance timers
    vi.advanceTimersByTime(1000);
    
    // Update task state to completed
    mockTeamCollaboration.updateTask(task.id, {
      state: TaskState.COMPLETED,
      result: 'Task result',
    });
    
    // Advance timers to complete workflow
    vi.advanceTimersByTime(2000);
    
    // Check final state
    const finalInstance = workflowOrchestration.getWorkflowInstance(instance.id);
    expect(finalInstance?.state).toBe(WorkflowInstanceState.COMPLETED);
  });
  
  test('should handle conditional branches in a workflow', () => {
    // Register workflow with condition
    workflowOrchestration.registerWorkflow({
      id: 'condition-workflow',
      name: 'Conditional Workflow',
      description: 'Workflow with conditional branches',
      inputs: {},
      outputs: {},
      metadata: {},
      nodes: [
        {
          id: 'start',
          type: WorkflowNodeType.START,
          name: 'Start',
          description: 'Start node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'condition',
          type: WorkflowNodeType.CONDITION,
          name: 'Condition',
          description: 'Condition node',
          condition: 'variables.takeTrue === true',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'true-node',
          type: WorkflowNodeType.TASK,
          name: 'True Path',
          description: 'True path node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'false-node',
          type: WorkflowNodeType.TASK,
          name: 'False Path',
          description: 'False path node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'end',
          type: WorkflowNodeType.END,
          name: 'End',
          description: 'End node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'start-to-condition',
          source: 'start',
          target: 'condition',
          label: '',
          metadata: {},
        },
        {
          id: 'condition-to-true',
          source: 'condition',
          target: 'true-node',
          condition: 'true',
          label: 'True path',
          metadata: {},
        },
        {
          id: 'condition-to-false',
          source: 'condition',
          target: 'false-node',
          condition: 'false',
          label: 'False path',
          metadata: {},
        },
        {
          id: 'true-to-end',
          source: 'true-node',
          target: 'end',
          label: '',
          metadata: {},
        },
        {
          id: 'false-to-end',
          source: 'false-node',
          target: 'end',
          label: '',
          metadata: {},
        },
      ],
    });
    
    // Create true path instance
    const trueInstance = workflowOrchestration.createWorkflowInstance('condition-workflow', { takeTrue: true });
    workflowOrchestration.startWorkflowInstance(trueInstance.id);
    
    // Create false path instance
    const falseInstance = workflowOrchestration.createWorkflowInstance('condition-workflow', { takeTrue: false });
    workflowOrchestration.startWorkflowInstance(falseInstance.id);
    
    // Advance timers
    vi.advanceTimersByTime(3000);
    
    // Check results (in a real test, we would need to check which path was taken)
    const finalTrueInstance = workflowOrchestration.getWorkflowInstance(trueInstance.id);
    const finalFalseInstance = workflowOrchestration.getWorkflowInstance(falseInstance.id);
    
    expect(finalTrueInstance?.state).toBe(WorkflowInstanceState.COMPLETED);
    expect(finalFalseInstance?.state).toBe(WorkflowInstanceState.COMPLETED);
  });
  
  test('should cancel a workflow instance', () => {
    // Register workflow
    workflowOrchestration.registerWorkflow({
      id: 'cancel-workflow',
      name: 'Cancelable Workflow',
      description: 'Workflow that will be canceled',
      inputs: {},
      outputs: {},
      metadata: {},
      nodes: [
        {
          id: 'start',
          type: WorkflowNodeType.START,
          name: 'Start',
          description: 'Start node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'long-task',
          type: WorkflowNodeType.TASK,
          name: 'Long Task',
          description: 'Long-running task',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'end',
          type: WorkflowNodeType.END,
          name: 'End',
          description: 'End node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'start-to-task',
          source: 'start',
          target: 'long-task',
          label: '',
          metadata: {},
        },
        {
          id: 'task-to-end',
          source: 'long-task',
          target: 'end',
          label: '',
          metadata: {},
        },
      ],
    });
    
    // Create and start instance
    const instance = workflowOrchestration.createWorkflowInstance('cancel-workflow');
    workflowOrchestration.startWorkflowInstance(instance.id);
    
    // Advance timer a bit
    vi.advanceTimersByTime(500);
    
    // Cancel the workflow
    const canceled = workflowOrchestration.cancelWorkflowInstance(instance.id);
    expect(canceled).toBe(true);
    
    // Check state
    const finalInstance = workflowOrchestration.getWorkflowInstance(instance.id);
    expect(finalInstance?.state).toBe(WorkflowInstanceState.CANCELED);
  });
  
  test('should handle workflow timeout', () => {
    // Create a workflow with a short timeout
    const workflowWithTimeout = new WorkflowOrchestration({
      teamCollaboration: mockTeamCollaboration as any,
      maxParallelTasks: 3,
      executionTimeout: 1000, // 1 second timeout
      enableAutoRecovery: false,
    });
    
    // Register workflow with task that won't complete
    workflowWithTimeout.registerWorkflow({
      id: 'timeout-workflow',
      name: 'Timeout Workflow',
      description: 'Workflow that will timeout',
      inputs: {},
      outputs: {},
      metadata: {},
      nodes: [
        {
          id: 'start',
          type: WorkflowNodeType.START,
          name: 'Start',
          description: 'Start node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'stuck-task',
          type: WorkflowNodeType.TASK,
          name: 'Stuck Task',
          description: 'Task that will not complete',
          inputs: {},
          outputs: {},
          metadata: {},
        },
        {
          id: 'end',
          type: WorkflowNodeType.END,
          name: 'End',
          description: 'End node',
          inputs: {},
          outputs: {},
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'start-to-task',
          source: 'start',
          target: 'stuck-task',
          label: '',
          metadata: {},
        },
        {
          id: 'task-to-end',
          source: 'stuck-task',
          target: 'end',
          label: '',
          metadata: {},
        },
      ],
    });
    
    // Create task for the workflow
    const task = mockTeamCollaboration.createTask({
      title: 'Stuck Task',
      description: 'Task that will not complete',
    });
    
    // Create and start instance
    const instance = workflowWithTimeout.createWorkflowInstance('timeout-workflow');
    workflowWithTimeout.startWorkflowInstance(instance.id);
    
    // Task is in progress but won't complete
    mockTeamCollaboration.updateTask(task.id, {
      state: TaskState.IN_PROGRESS,
    });
    
    // Advance timer beyond timeout
    vi.advanceTimersByTime(1500);
    
    // Check state
    const finalInstance = workflowWithTimeout.getWorkflowInstance(instance.id);
    expect(finalInstance?.state).toBe(WorkflowInstanceState.FAILED);
    expect(finalInstance?.error).toContain('timeout');
  });
}); 