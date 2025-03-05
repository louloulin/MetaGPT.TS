export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'paused' | 'error';
  currentTask?: string;
  capabilities: string[];
  metrics: {
    tasksCompleted: number;
    successRate: number;
    averageResponseTime: number;
    memoryUsage: number;
  };
  performance?: {
    tasksCompleted: number;
    averageTime: number;
    successRate: number;
  };
  metadata?: Record<string, unknown>;
} 