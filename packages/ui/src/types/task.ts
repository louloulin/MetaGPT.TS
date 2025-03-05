export interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  status: 'pending' | 'running' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  dependencies?: string[];
  error?: string;
  metadata?: Record<string, unknown>;
} 