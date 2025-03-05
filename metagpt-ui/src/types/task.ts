export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
} 