/**
 * Code TODOs Management Utility
 * 
 * Provides a flexible system for managing and tracking coding tasks
 * to enhance developer workflow and task organization.
 * 
 * @module utils/code-todos
 * @category Core
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

/**
 * Priority levels for code tasks
 */
export enum TaskPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Status options for code tasks
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  SKIPPED = 'skipped'
}

/**
 * Schema for a code task
 */
export const CodeTaskSchema = z.object({
  /** Unique identifier for the task */
  id: z.string().default(() => uuidv4()),
  /** Short title of the task */
  title: z.string(),
  /** Detailed description of what needs to be done */
  description: z.string(),
  /** Task priority */
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  /** Current status */
  status: z.nativeEnum(TaskStatus).default(TaskStatus.PENDING),
  /** Created timestamp */
  createdAt: z.date().default(() => new Date()),
  /** Last updated timestamp */
  updatedAt: z.date().default(() => new Date()),
  /** Dependencies - IDs of tasks that must be completed before this one */
  dependencies: z.array(z.string()).default([]),
  /** Estimated complexity (1-10) */
  complexity: z.number().min(1).max(10).default(5),
  /** File paths this task relates to */
  files: z.array(z.string()).default([]),
  /** Associated tags */
  tags: z.array(z.string()).default([]),
  /** Optional notes */
  notes: z.string().optional(),
  /** Task solution or implementation details */
  solution: z.string().optional(),
  /** Task metadata */
  metadata: z.record(z.any()).optional(),
});

export type CodeTask = z.infer<typeof CodeTaskSchema>;

/**
 * Schema for a code todo list
 */
export const CodeTodoListSchema = z.object({
  /** Unique identifier for this list */
  id: z.string().default(() => uuidv4()),
  /** Name of the code todo list */
  name: z.string(),
  /** Description of the todo list purpose */
  description: z.string().optional(),
  /** List of tasks */
  tasks: z.array(CodeTaskSchema).default([]),
  /** Completion status */
  isComplete: z.boolean().default(false),
  /** Project context */
  project: z.string().optional(),
  /** Created timestamp */
  createdAt: z.date().default(() => new Date()),
  /** Last updated timestamp */
  updatedAt: z.date().default(() => new Date()),
});

export type CodeTodoList = z.infer<typeof CodeTodoListSchema>;

/**
 * CodeTodoManager - Manages multiple sets of code todos
 */
export class CodeTodoManager {
  private todoLists: Map<string, CodeTodoList> = new Map();
  private currentListId: string | null = null;
  
  /**
   * Create a new code todo manager
   */
  constructor() {}
  
  /**
   * Create a new todo list
   */
  createList(name: string, description?: string, project?: string): string {
    const todoList = CodeTodoListSchema.parse({
      name,
      description,
      project,
      tasks: []
    });
    
    this.todoLists.set(todoList.id, todoList);
    
    // Set as current if none is selected
    if (this.currentListId === null) {
      this.currentListId = todoList.id;
    }
    
    return todoList.id;
  }
  
  /**
   * Select a todo list as the current active list
   */
  selectList(listId: string): void {
    if (!this.todoLists.has(listId)) {
      throw new Error(`Todo list with ID ${listId} not found`);
    }
    
    this.currentListId = listId;
  }
  
  /**
   * Get the current todo list
   */
  getCurrentList(): CodeTodoList | null {
    if (!this.currentListId) {
      return null;
    }
    
    return this.todoLists.get(this.currentListId) || null;
  }
  
  /**
   * Get all todo lists
   */
  getAllLists(): CodeTodoList[] {
    return Array.from(this.todoLists.values());
  }
  
  /**
   * Add a task to the current todo list
   */
  addTask(task: Omit<CodeTask, 'id' | 'createdAt' | 'updatedAt' | 'status'>): string {
    const currentList = this.getCurrentList();
    if (!currentList) {
      throw new Error('No active todo list selected');
    }
    
    const newTask = CodeTaskSchema.parse({
      ...task,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: TaskStatus.PENDING
    });
    
    const updatedList = {
      ...currentList,
      tasks: [...currentList.tasks, newTask],
      updatedAt: new Date()
    };
    
    this.todoLists.set(currentList.id, updatedList);
    return newTask.id;
  }
  
  /**
   * Add multiple tasks to the current todo list
   */
  addTasks(tasks: Omit<CodeTask, 'id' | 'createdAt' | 'updatedAt' | 'status'>[]): string[] {
    const taskIds: string[] = [];
    
    for (const task of tasks) {
      taskIds.push(this.addTask(task));
    }
    
    return taskIds;
  }
  
  /**
   * Update a task in the current todo list
   */
  updateTask(taskId: string, updates: Partial<Omit<CodeTask, 'id' | 'createdAt'>>): void {
    const currentList = this.getCurrentList();
    if (!currentList) {
      throw new Error('No active todo list selected');
    }
    
    const taskIndex = currentList.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    const updatedTask = {
      ...currentList.tasks[taskIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    const updatedTasks = [...currentList.tasks];
    updatedTasks[taskIndex] = updatedTask;
    
    const updatedList = {
      ...currentList,
      tasks: updatedTasks,
      updatedAt: new Date()
    };
    
    this.todoLists.set(currentList.id, updatedList);
  }
  
  /**
   * Remove a task from the current todo list
   */
  removeTask(taskId: string): void {
    const currentList = this.getCurrentList();
    if (!currentList) {
      throw new Error('No active todo list selected');
    }
    
    const updatedList = {
      ...currentList,
      tasks: currentList.tasks.filter(t => t.id !== taskId),
      updatedAt: new Date()
    };
    
    this.todoLists.set(currentList.id, updatedList);
  }
  
  /**
   * Change the status of a task
   */
  setTaskStatus(taskId: string, status: TaskStatus): void {
    this.updateTask(taskId, { status });
  }
  
  /**
   * Get a task by its ID
   */
  getTask(taskId: string): CodeTask | null {
    const currentList = this.getCurrentList();
    if (!currentList) {
      return null;
    }
    
    return currentList.tasks.find(t => t.id === taskId) || null;
  }
  
  /**
   * Get all tasks in the current list
   */
  getAllTasks(): CodeTask[] {
    const currentList = this.getCurrentList();
    if (!currentList) {
      return [];
    }
    
    return currentList.tasks;
  }
  
  /**
   * Get tasks filtered by status
   */
  getTasksByStatus(status: TaskStatus): CodeTask[] {
    const currentList = this.getCurrentList();
    if (!currentList) {
      return [];
    }
    
    return currentList.tasks.filter(t => t.status === status);
  }
  
  /**
   * Get the next task to work on (first pending task without dependencies or with satisfied dependencies)
   */
  getNextTask(): CodeTask | null {
    const currentList = this.getCurrentList();
    if (!currentList) {
      return null;
    }
    
    const pendingTasks = currentList.tasks.filter(t => t.status === TaskStatus.PENDING);
    
    // Find tasks with no dependencies or with all dependencies satisfied
    for (const task of pendingTasks) {
      if (task.dependencies.length === 0) {
        return task;
      }
      
      const hasUnresolvedDependencies = task.dependencies.some(depId => {
        const depTask = currentList.tasks.find(t => t.id === depId);
        return !depTask || depTask.status !== TaskStatus.COMPLETED;
      });
      
      if (!hasUnresolvedDependencies) {
        return task;
      }
    }
    
    return null;
  }
  
  /**
   * Generate a dependency graph of tasks in DOT format (Graphviz)
   */
  generateTaskGraph(): string {
    const currentList = this.getCurrentList();
    if (!currentList) {
      return '';
    }
    
    let dot = 'digraph G {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box, style=filled];\n\n';
    
    // Add nodes
    for (const task of currentList.tasks) {
      let color = '';
      switch (task.status) {
        case TaskStatus.COMPLETED:
          color = 'lightgreen';
          break;
        case TaskStatus.IN_PROGRESS:
          color = 'lightblue';
          break;
        case TaskStatus.PENDING:
          color = 'lightgrey';
          break;
        case TaskStatus.BLOCKED:
          color = 'lightcoral';
          break;
        case TaskStatus.SKIPPED:
          color = 'lightgrey';
          break;
      }
      
      dot += `  "${task.id}" [label="${task.title}", fillcolor="${color}"];\n`;
    }
    
    dot += '\n';
    
    // Add edges for dependencies
    for (const task of currentList.tasks) {
      for (const depId of task.dependencies) {
        dot += `  "${depId}" -> "${task.id}";\n`;
      }
    }
    
    dot += '}\n';
    return dot;
  }
  
  /**
   * Generate a markdown report of the todo list
   */
  generateMarkdownReport(): string {
    const currentList = this.getCurrentList();
    if (!currentList) {
      return '# No active todo list selected';
    }
    
    let md = `# ${currentList.name}\n\n`;
    
    if (currentList.description) {
      md += `${currentList.description}\n\n`;
    }
    
    // Summary
    const totalTasks = currentList.tasks.length;
    const completedTasks = currentList.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const inProgressTasks = currentList.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const pendingTasks = currentList.tasks.filter(t => t.status === TaskStatus.PENDING).length;
    const blockedTasks = currentList.tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
    
    md += `## Summary\n\n`;
    md += `- Total tasks: ${totalTasks}\n`;
    md += `- Completed: ${completedTasks} (${Math.round((completedTasks / totalTasks) * 100)}%)\n`;
    md += `- In progress: ${inProgressTasks}\n`;
    md += `- Pending: ${pendingTasks}\n`;
    md += `- Blocked: ${blockedTasks}\n\n`;
    
    // Tasks by priority
    md += `## Tasks by Priority\n\n`;
    
    for (const priority of Object.values(TaskPriority)) {
      const tasksWithPriority = currentList.tasks.filter(t => t.priority === priority);
      if (tasksWithPriority.length === 0) continue;
      
      md += `### ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority\n\n`;
      
      for (const task of tasksWithPriority) {
        const statusEmoji = task.status === TaskStatus.COMPLETED ? '✅' : 
                          task.status === TaskStatus.IN_PROGRESS ? '🔄' : 
                          task.status === TaskStatus.BLOCKED ? '🚫' : 
                          task.status === TaskStatus.SKIPPED ? '⏭️' : '⏳';
        
        md += `- ${statusEmoji} **${task.title}** (ID: ${task.id.substring(0, 8)})\n`;
        md += `  ${task.description}\n`;
        
        if (task.files.length > 0) {
          md += `  Files: ${task.files.join(', ')}\n`;
        }
        
        if (task.solution) {
          md += `  Solution: ${task.solution}\n`;
        }
        
        md += '\n';
      }
    }
    
    return md;
  }
  
  /**
   * Mark the current todo list as complete
   */
  markListAsComplete(): void {
    const currentList = this.getCurrentList();
    if (!currentList) {
      throw new Error('No active todo list selected');
    }
    
    const updatedList = {
      ...currentList,
      isComplete: true,
      updatedAt: new Date()
    };
    
    this.todoLists.set(currentList.id, updatedList);
  }
  
  /**
   * Delete a todo list
   */
  deleteList(listId: string): void {
    if (!this.todoLists.has(listId)) {
      throw new Error(`Todo list with ID ${listId} not found`);
    }
    
    this.todoLists.delete(listId);
    
    // Reset current list if deleted
    if (this.currentListId === listId) {
      this.currentListId = null;
    }
  }
  
  /**
   * Parse a string representation of tasks into a structured todo list
   * This can be used to extract TODO comments from code or parse a list from a message
   */
  parseTodoString(todoString: string, name: string = 'Parsed Tasks'): string {
    // Create a new list
    const listId = this.createList(name);
    this.selectList(listId);
    
    // Extract tasks from the string
    const taskRegex = /(?:TODO|FIXME|BUG|HACK|NOTE|TASK)(?:\(([^)]+)\))?:?\s*(.*?)(?=\n\s*(?:TODO|FIXME|BUG|HACK|NOTE|TASK)|$)/gis;
    let match;
    
    while ((match = taskRegex.exec(todoString)) !== null) {
      const priorityTag = match[1]?.trim().toLowerCase() || '';
      const description = match[2]?.trim() || '';
      
      if (!description) continue;
      
      // Determine priority from tag
      let priority = TaskPriority.MEDIUM;
      if (priorityTag.includes('high') || priorityTag.includes('critical')) {
        priority = TaskPriority.HIGH;
      } else if (priorityTag.includes('low')) {
        priority = TaskPriority.LOW;
      }
      
      // Extract file references
      const fileRefs: string[] = [];
      const fileMatches = description.match(/(?:in|file|path):\s*([^\s,;]+)/g);
      if (fileMatches) {
        for (const fileMatch of fileMatches) {
          const file = fileMatch.replace(/(?:in|file|path):\s*/, '').trim();
          fileRefs.push(file);
        }
      }
      
      // Create a title from first sentence or line
      const titleMatch = description.match(/^(.+?)(?:\.\s|$|\n)/);
      const title = titleMatch ? titleMatch[1] : description.substring(0, 40) + '...';
      
      this.addTask({
        title,
        description,
        priority,
        files: fileRefs,
        complexity: 5,
        dependencies: [],
        tags: priorityTag ? [priorityTag] : []
      });
    }
    
    return listId;
  }
} 