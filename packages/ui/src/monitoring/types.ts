export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  errorRate: number;
}

export interface AgentActivity {
  agentId: string;
  timestamp: Date;
  action: string;
  details: Record<string, unknown>;
}

export interface TaskProgress {
  completed: number;
  total: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface MonitoringError {
  timestamp: Date;
  type: string;
  message: string;
  agentId?: string;
  taskId?: string;
} 