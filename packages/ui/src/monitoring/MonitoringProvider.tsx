import React, { createContext, useContext, useState, useEffect } from 'react';
import { SystemMetrics, AgentActivity, TaskProgress, MonitoringError } from './types';
import { getMockMetrics, generateMockError } from '../services/mockApi';

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

interface MonitoringProviderProps {
  children: React.ReactNode;
  pollInterval?: number;
  errorGenerationInterval?: number;
  initialErrors?: number;
}

const MonitoringContext = createContext<MonitoringContextType>({
  state: {
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
  },
  updateMetrics: () => {},
  logAgentActivity: () => {},
  updateTaskProgress: () => {},
  logError: () => {},
  clearErrors: () => {},
});

export const useMonitoring = () => useContext(MonitoringContext);

export const MonitoringProvider: React.FC<MonitoringProviderProps> = ({
  children,
  pollInterval = 5000,
  errorGenerationInterval = 10000,
  initialErrors = 5,
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

  // 初始化时生成一些随机错误
  useEffect(() => {
    for (let i = 0; i < initialErrors; i++) {
      logError(generateMockError());
    }
  }, []);

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
    
    const metricsIntervalId = setInterval(fetchMetrics, pollInterval);
    return () => clearInterval(metricsIntervalId);
  }, [pollInterval]);

  // 定期生成随机错误
  useEffect(() => {
    // 每隔一段时间生成一个随机错误
    const generateRandomError = () => {
      // 根据当前错误率调整生成错误的概率
      const errorRate = state.metrics.errorRate;
      // 错误率越高，生成错误的概率越高
      const shouldGenerateError = Math.random() * 10 < errorRate;
      
      if (shouldGenerateError) {
        logError(generateMockError());
      }
    };
    
    const errorIntervalId = setInterval(generateRandomError, errorGenerationInterval);
    return () => clearInterval(errorIntervalId);
  }, [errorGenerationInterval, state.metrics.errorRate]);

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