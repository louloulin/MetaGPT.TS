export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'paused' | 'error';
  currentTask?: string;
  performance?: {
    tasksCompleted: number;
    averageTime: number;
    successRate: number;
  };
  metadata?: Record<string, unknown>;
} 