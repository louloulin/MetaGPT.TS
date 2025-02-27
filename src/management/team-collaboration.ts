import { z } from 'zod';
import type { Role } from '../types/role';
import type { Message } from '../types/message';
import type { Team } from './team';
import { logger } from '../utils/logger';

/**
 * Task state enumeration
 */
export enum TaskState {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Task schema
 */
export const TaskSchema = z.object({
  /** Unique task identifier */
  id: z.string(),
  /** Task title */
  title: z.string(),
  /** Task description */
  description: z.string(),
  /** Task assignee (role name) */
  assignee: z.string().optional(),
  /** Task dependencies (task IDs) */
  dependencies: z.array(z.string()).default([]),
  /** Task state */
  state: z.nativeEnum(TaskState).default(TaskState.PENDING),
  /** Task priority (1-5, 5 is highest) */
  priority: z.number().min(1).max(5).default(3),
  /** Task creation timestamp */
  createdAt: z.date().default(() => new Date()),
  /** Task update timestamp */
  updatedAt: z.date().default(() => new Date()),
  /** Task result/output */
  result: z.any().optional(),
  /** Task error (if failed) */
  error: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * TeamCollaboration configuration schema
 */
export const TeamCollaborationConfigSchema = z.object({
  /** Team reference */
  team: z.any(),
  /** Maximum concurrent tasks per role */
  maxConcurrentTasksPerRole: z.number().default(1),
  /** Whether to automatically assign tasks based on role capabilities */
  autoAssignTasks: z.boolean().default(true),
});

export type TeamCollaborationConfig = z.infer<typeof TeamCollaborationConfigSchema>;

/**
 * TeamCollaboration class for managing team workflows and task coordination
 * 
 * This class provides task management, assignment, and workflow orchestration
 * capabilities for teams of roles (agents).
 */
export class TeamCollaboration {
  /** Configuration */
  private config: TeamCollaborationConfig;
  /** Team reference */
  private team: Team;
  /** Tasks map (by task ID) */
  private tasks: Map<string, Task> = new Map();
  /** Workflows map (by workflow ID) */
  private workflows: Map<string, Task[]> = new Map();
  /** Role task assignments (role name -> task IDs) */
  private roleAssignments: Map<string, Set<string>> = new Map();
  /** Task dependencies (task ID -> dependent task IDs) */
  private taskDependencies: Map<string, Set<string>> = new Map();

  /**
   * Create a new TeamCollaboration instance
   * @param config Configuration
   */
  constructor(config: TeamCollaborationConfig) {
    this.config = TeamCollaborationConfigSchema.parse(config);
    this.team = this.config.team;
  }

  /**
   * Create a new task
   * @param taskData Task data
   * @returns Created task
   */
  public createTask(taskData: Partial<Task> & Pick<Task, 'title' | 'description'>): Task {
    // Generate unique ID if not provided
    if (!taskData.id) {
      taskData.id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // Create task
    const task = TaskSchema.parse({
      ...taskData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Store task
    this.tasks.set(task.id, task);

    // Track dependencies
    if (task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        if (!this.taskDependencies.has(depId)) {
          this.taskDependencies.set(depId, new Set());
        }
        this.taskDependencies.get(depId)?.add(task.id);
      }
    }

    logger.info(`Created task ${task.id}: ${task.title}`);

    // Auto-assign if configured
    if (this.config.autoAssignTasks && !task.assignee) {
      this.assignTaskToOptimalRole(task);
    }

    return task;
  }

  /**
   * Get a task by ID
   * @param id Task ID
   * @returns Task or undefined if not found
   */
  public getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   * @returns Array of tasks
   */
  public getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Update a task
   * @param id Task ID
   * @param updates Task updates
   * @returns Updated task or undefined if not found
   */
  public updateTask(id: string, updates: Partial<Omit<Task, 'id'>>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) {
      return undefined;
    }

    // Update task
    const updatedTask = {
      ...task,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    // Validate and store
    const validatedTask = TaskSchema.parse(updatedTask);
    this.tasks.set(id, validatedTask);

    // Update assignments if assignee changed
    if (updates.assignee && updates.assignee !== task.assignee) {
      // Remove from previous assignee
      if (task.assignee) {
        const prevAssignments = this.roleAssignments.get(task.assignee);
        if (prevAssignments) {
          prevAssignments.delete(id);
        }
      }

      // Add to new assignee
      this.assignTaskToRole(validatedTask, updates.assignee);
    }

    // Check if task completed and update dependent tasks
    if (updates.state === TaskState.COMPLETED && task.state !== TaskState.COMPLETED) {
      this.updateDependentTasks(id);
    }

    return validatedTask;
  }

  /**
   * Delete a task
   * @param id Task ID
   * @returns Whether the task was deleted
   */
  public deleteTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) {
      return false;
    }

    // Remove task
    this.tasks.delete(id);

    // Remove from assignments
    if (task.assignee) {
      const assignments = this.roleAssignments.get(task.assignee);
      if (assignments) {
        assignments.delete(id);
      }
    }

    // Remove from dependencies
    if (this.taskDependencies.has(id)) {
      this.taskDependencies.delete(id);
    }

    // Remove as dependency from other tasks
    for (const task of this.tasks.values()) {
      if (task.dependencies.includes(id)) {
        task.dependencies = task.dependencies.filter(depId => depId !== id);
      }
    }

    return true;
  }

  /**
   * Assign a task to a role
   * @param task Task or task ID
   * @param roleName Role name
   * @returns Whether the assignment was successful
   */
  public assignTaskToRole(task: Task | string, roleName: string): boolean {
    const taskObj = typeof task === 'string' ? this.tasks.get(task) : task;
    if (!taskObj) {
      return false;
    }

    const role = this.getRoleByName(roleName);
    if (!role) {
      return false;
    }

    // Initialize role assignments if needed
    if (!this.roleAssignments.has(roleName)) {
      this.roleAssignments.set(roleName, new Set());
    }

    // Assign task
    const assignments = this.roleAssignments.get(roleName)!;
    assignments.add(taskObj.id);

    // Update task
    this.updateTask(taskObj.id, {
      assignee: roleName,
      state: TaskState.ASSIGNED,
    });

    return true;
  }

  /**
   * Get tasks assigned to a role
   * @param roleName Role name
   * @returns Array of tasks assigned to the role
   */
  public getTasksForRole(roleName: string): Task[] {
    const assignments = this.roleAssignments.get(roleName);
    if (!assignments) {
      return [];
    }

    return Array.from(assignments)
      .map(id => this.tasks.get(id))
      .filter((task): task is Task => !!task);
  }

  /**
   * Create a new workflow (sequence of related tasks)
   * @param workflowId Workflow ID
   * @param tasks Array of tasks or task data
   * @returns Array of created/added tasks
   */
  public createWorkflow(
    workflowId: string,
    tasks: Array<Task | (Partial<Task> & Pick<Task, 'title' | 'description'>)>
  ): Task[] {
    const workflowTasks: Task[] = [];

    // Create/add tasks
    for (let i = 0; i < tasks.length; i++) {
      const taskData = tasks[i];
      
      // If task already exists, add it to workflow
      if ('id' in taskData && this.tasks.has(taskData.id)) {
        workflowTasks.push(this.tasks.get(taskData.id)!);
        continue;
      }

      // If it's a sequence and not the first task, add previous task as dependency
      if (i > 0 && workflowTasks.length > 0) {
        const prevTask = workflowTasks[workflowTasks.length - 1];
        if (!('dependencies' in taskData)) {
          (taskData as any).dependencies = [];
        }
        if (Array.isArray((taskData as any).dependencies)) {
          (taskData as any).dependencies.push(prevTask.id);
        }
      }

      // Create task
      const task = this.createTask(taskData as any);
      workflowTasks.push(task);
    }

    // Store workflow
    this.workflows.set(workflowId, workflowTasks);

    return workflowTasks;
  }

  /**
   * Get a workflow by ID
   * @param workflowId Workflow ID
   * @returns Array of tasks in the workflow
   */
  public getWorkflow(workflowId: string): Task[] | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Start a workflow
   * @param workflowId Workflow ID
   * @returns Whether the workflow was started
   */
  public startWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    // Find tasks that have no dependencies or all dependencies are complete
    const tasksToStart = workflow.filter(task => 
      task.state === TaskState.PENDING && 
      this.canTaskStart(task)
    );

    // Start tasks
    for (const task of tasksToStart) {
      if (task.assignee) {
        this.updateTask(task.id, { state: TaskState.IN_PROGRESS });
      } else {
        this.assignTaskToOptimalRole(task);
      }
    }

    return true;
  }

  /**
   * Check if a task can start (all dependencies are complete)
   * @param task Task to check
   * @returns Whether the task can start
   */
  private canTaskStart(task: Task): boolean {
    if (task.dependencies.length === 0) {
      return true;
    }

    for (const depId of task.dependencies) {
      const depTask = this.tasks.get(depId);
      if (!depTask || depTask.state !== TaskState.COMPLETED) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update tasks that depend on a completed task
   * @param taskId ID of the completed task
   */
  private updateDependentTasks(taskId: string): void {
    const dependents = this.taskDependencies.get(taskId);
    if (!dependents) {
      return;
    }

    for (const depId of dependents) {
      const depTask = this.tasks.get(depId);
      if (depTask && depTask.state === TaskState.PENDING) {
        // Check if all dependencies are complete
        if (this.canTaskStart(depTask)) {
          if (depTask.assignee) {
            this.updateTask(depId, { state: TaskState.IN_PROGRESS });
          } else {
            this.assignTaskToOptimalRole(depTask);
          }
        }
      }
    }
  }

  /**
   * Find and assign a task to the optimal role based on capabilities and current workload
   * @param task Task to assign
   * @returns Whether the assignment was successful
   */
  private assignTaskToOptimalRole(task: Task): boolean {
    // Simple implementation: assign to first available role
    // In a more advanced implementation, this would consider role capabilities
    
    const roles = (this.team as any).getRoles?.() || [];
    
    for (const role of roles) {
      const roleName = role.name;
      const assignments = this.roleAssignments.get(roleName) || new Set();
      
      // Check if role has capacity
      if (assignments.size < this.config.maxConcurrentTasksPerRole) {
        return this.assignTaskToRole(task, roleName);
      }
    }
    
    logger.warn(`Could not find available role for task ${task.id}`);
    return false;
  }

  /**
   * Get a role by name
   * @param name Role name
   * @returns Role or undefined if not found
   */
  private getRoleByName(name: string): Role | undefined {
    return (this.team as any).getRole?.(name);
  }
} 