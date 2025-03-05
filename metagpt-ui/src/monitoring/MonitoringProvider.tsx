import React, { createContext, useContext, useState, useEffect } from 'react';
import { SystemMetrics, AgentActivity, TaskProgress, MonitoringError } from './types';
import { getMockMetrics } from '../services/mockApi';

interface MonitoringState {
  metrics: SystemMetrics;
  agentActivities: AgentActivity[];
  taskProgress: Record<string, TaskProgress>;
  errors: MonitoringError[];
}

interface MonitoringContextType {
  state: MonitoringState;
  updateMetrics: (metrics: Partial<SystemMetrics>) => void;
  logAgentActivity: (
    agentId: string,
    action: string,
    details: Record<string, unknown>
  ) => void;
  updateTaskProgress: (
    taskId: string,
    progress: TaskProgress
  ) => void;
  logError: (error: Omit<MonitoringError, 'timestamp'>) => void;
  clearErrors: () => void;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

export const useMonitoring = () => {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
};

interface MonitoringProviderProps {
  children: React.ReactNode;
  pollInterval?: number;
}

export const MonitoringProvider: React.FC<MonitoringProviderProps> = ({
  children,
  pollInterval = 5000,
}) => {
  const [state, setState] = useState<MonitoringState>({
    metrics: {
      cpuUsage: 0,
      memoryUsage: 0,
      networkLatency: 0,
      activeAgents: 0,
      totalTasks: 0,
      completedTasks: 0,
      errorRate: 0,
    },
    agentActivities: [],
    taskProgress: {},
    errors: [],
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const metrics = await getMockMetrics();
        updateMetrics(metrics);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    // Initial fetch
    fetchMetrics();
    
    const intervalId = setInterval(fetchMetrics, pollInterval);
    return () => clearInterval(intervalId);
  }, [pollInterval]);

  const updateMetrics = (metrics: Partial<SystemMetrics>) => {
    setState(prev => ({
      ...prev,
      metrics: { ...prev.metrics, ...metrics },
    }));
  };

  const logAgentActivity = (
    agentId: string,
    action: string,
    details: Record<string, unknown>
  ) => {
    setState(prev => ({
      ...prev,
      agentActivities: [
        {
          agentId,
          timestamp: new Date(),
          action,
          details,
        },
        ...prev.agentActivities,
      ].slice(0, 100), // Keep the most recent 100 activities
    }));
  };

  const updateTaskProgress = (
    taskId: string,
    progress: TaskProgress
  ) => {
    setState(prev => ({
      ...prev,
      taskProgress: {
        ...prev.taskProgress,
        [taskId]: progress,
      },
    }));
  };

  const logError = (error: Omit<MonitoringError, 'timestamp'>) => {
    setState(prev => ({
      ...prev,
      errors: [
        {
          timestamp: new Date(),
          ...error,
        },
        ...prev.errors,
      ],
    }));
  };

  const clearErrors = () => {
    setState(prev => ({
      ...prev,
      errors: [],
    }));
  };

  const value = {
    state,
    updateMetrics,
    logAgentActivity,
    updateTaskProgress,
    logError,
    clearErrors,
  };

  return (
    <MonitoringContext.Provider value={value}>
      {children}
    </MonitoringContext.Provider>
  );
}; 