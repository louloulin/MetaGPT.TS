export interface AgentInfo {
  name: string;
  status: 'active' | 'inactive' | 'busy';
  capabilities: string[];
  metrics: {
    tasksCompleted: number;
    successRate: number;
    avgResponseTime: number;
  };
}

export interface Task {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  assignedTo?: string;
} 