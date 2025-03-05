import React, { useState } from 'react';
import {
  MetaGPTProvider,
  AgentCard,
  TaskQueue,
  AgentNetwork,
  MetricsDisplay,
  type AgentInfo,
  type Task,
} from '../src';

const mockAgents: AgentInfo[] = [
  {
    id: '1',
    name: 'Planner',
    status: 'working',
    capabilities: ['planning', 'task decomposition', 'goal setting'],
    metrics: {
      tasksCompleted: 150,
      successRate: 0.95,
      averageResponseTime: 1200,
      memoryUsage: 256,
    },
    connections: ['2', '3'],
  },
  {
    id: '2',
    name: 'Coder',
    status: 'idle',
    capabilities: ['typescript', 'python', 'react'],
    metrics: {
      tasksCompleted: 324,
      successRate: 0.88,
      averageResponseTime: 800,
      memoryUsage: 512,
    },
    connections: ['1', '3'],
  },
  {
    id: '3',
    name: 'Reviewer',
    status: 'working',
    capabilities: ['code review', 'testing', 'documentation'],
    metrics: {
      tasksCompleted: 289,
      successRate: 0.92,
      averageResponseTime: 1500,
      memoryUsage: 384,
    },
    connections: ['1', '2'],
  },
];

const mockTasks: Task[] = [
  {
    id: '1',
    type: 'Feature Implementation',
    priority: 'high',
    status: 'in_progress',
    progress: 75,
    createdAt: new Date(),
    assignedTo: 'Coder',
  },
  {
    id: '2',
    type: 'Code Review',
    priority: 'medium',
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
    assignedTo: 'Reviewer',
  },
  {
    id: '3',
    type: 'Bug Fix',
    priority: 'high',
    status: 'completed',
    progress: 100,
    createdAt: new Date(),
    assignedTo: 'Coder',
  },
];

const mockMetrics = [
  {
    name: 'System Load',
    value: 65,
    unit: '%',
    trend: 'up' as const,
    threshold: {
      warning: 70,
      critical: 90,
    },
  },
  {
    name: 'Memory Usage',
    value: 4.2,
    unit: 'GB',
    trend: 'stable' as const,
    threshold: {
      warning: 6,
      critical: 7.5,
    },
  },
  {
    name: 'Response Time',
    value: 250,
    unit: 'ms',
    trend: 'down' as const,
    threshold: {
      warning: 500,
      critical: 1000,
    },
  },
  {
    name: 'Success Rate',
    value: 98.5,
    unit: '%',
    trend: 'stable' as const,
    threshold: {
      warning: 95,
      critical: 90,
    },
  },
];

const App: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  const handleAgentClick = (agent: AgentInfo) => {
    setSelectedAgent(agent);
  };

  const handleTaskClick = (task: Task) => {
    console.log('Task clicked:', task);
  };

  const handleMetricThresholdExceeded = (metric: any) => {
    console.warn(`Metric ${metric.name} exceeded threshold: ${metric.value}${metric.unit}`);
  };

  return (
    <MetaGPTProvider>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>MetaGPT Dashboard</h1>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>System Metrics</h2>
          <MetricsDisplay
            metrics={mockMetrics}
            layout="grid"
            showTrends
            onThresholdExceeded={handleMetricThresholdExceeded}
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Agent Network</h2>
          <AgentNetwork
            agents={mockAgents}
            width={800}
            height={400}
            onAgentClick={handleAgentClick}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          <div>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Agents</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {mockAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={handleAgentClick}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Task Queue</h2>
            <TaskQueue
              tasks={mockTasks}
              onTaskClick={handleTaskClick}
            />
          </div>
        </div>
      </div>
    </MetaGPTProvider>
  );
};

export default App; 