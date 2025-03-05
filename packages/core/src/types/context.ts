import type { MemoryManager } from './memory';
import type { Role } from './role';

/**
 * Action context interface
 */
export interface ActionContext {
  name: string;
  description: string;
  args?: Record<string, any>;
  memory?: MemoryManager;
  workingMemory?: MemoryManager;
  role?: Role;
} 