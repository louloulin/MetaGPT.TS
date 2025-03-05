import { SystemMetrics } from '../monitoring/types';

export const getMockMetrics = async (): Promise<SystemMetrics> => {
  return {
    cpuUsage: Math.random() * 100,
    memoryUsage: Math.random() * 100,
    networkLatency: Math.random() * 200,
    activeAgents: Math.floor(Math.random() * 10),
    totalTasks: 100,
    completedTasks: Math.floor(Math.random() * 100),
    errorRate: Math.random() * 5,
  };
}; 